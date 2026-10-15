"""
RAG Pipeline — PDF ingestion, chunking, embedding, vector search.

Uses PyMuPDF for text extraction and ChromaDB for vector storage.
sentence-transformers (all-MiniLM-L6-v2) for local embeddings — no API key needed.
"""
import os
import re
import logging
import hashlib
from typing import List, Tuple, Dict, Any, Optional
from pathlib import Path

import pymupdf as fitz  # PyMuPDF — suppress deprecation warning
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Resolve to absolute paths so background tasks work regardless of CWD
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads")).resolve()
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", "./chroma_db")).resolve()
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))      # tokens approx
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Embedding model (loaded once)
# ---------------------------------------------------------------------------

_embedding_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading embedding model all-MiniLM-L6-v2…")
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded.")
    return _embedding_model


# ---------------------------------------------------------------------------
# ChromaDB client
# ---------------------------------------------------------------------------

_chroma_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _chroma_client


def get_collection(collection_name: str = "learnova_docs"):
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_path: Path) -> List[Tuple[int, str]]:
    """
    Extract text per page.
    Returns list of (page_number, text) tuples.
    Raises ValueError for scanned-only PDFs with no extractable text.
    Uses stream mode to avoid Windows path issues with special characters/spaces.
    """
    with open(file_path, "rb") as f:
        data = f.read()
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    total_chars = 0
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        total_chars += len(text)
        pages.append((page_num + 1, text))
    doc.close()

    if total_chars < 30:
        raise ValueError(
            "This PDF appears to be scanned (image-only) and contains very little "
            "extractable text. OCR support is not currently installed. "
            "Please use a text-based PDF or a PDF with a text layer."
        )
    return pages


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def split_into_chunks(
    pages: List[Tuple[int, str]],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[Dict[str, Any]]:
    """
    Splits pages into overlapping word-chunks preserving page provenance.
    Returns list of {text, page_number, chunk_index}.
    """
    chunks = []
    chunk_index = 0
    buffer_words: List[str] = []
    buffer_pages: List[int] = []

    for page_num, text in pages:
        words = text.split()
        for word in words:
            buffer_words.append(word)
            buffer_pages.append(page_num)
            if len(buffer_words) >= chunk_size:
                chunk_text = " ".join(buffer_words)
                # Dominant page
                from collections import Counter
                page_counts = Counter(buffer_pages)
                dominant_page = page_counts.most_common(1)[0][0]
                chunks.append({
                    "text": chunk_text,
                    "page_number": dominant_page,
                    "chunk_index": chunk_index,
                })
                chunk_index += 1
                # slide window by (chunk_size - overlap)
                slide = chunk_size - overlap
                buffer_words = buffer_words[slide:]
                buffer_pages = buffer_pages[slide:]

    # flush remaining
    if buffer_words:
        chunk_text = " ".join(buffer_words)
        from collections import Counter
        page_counts = Counter(buffer_pages)
        dominant_page = page_counts.most_common(1)[0][0]
        chunks.append({
            "text": chunk_text,
            "page_number": dominant_page,
            "chunk_index": chunk_index,
        })
    return chunks


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------

def index_document(
    document_id: int,
    subject_id: int,
    original_name: str,
    file_path: Path,
) -> int:
    """
    Full ingestion pipeline: extract → chunk → embed → store.
    Returns number of chunks stored.
    """
    pages = extract_text_from_pdf(file_path)
    chunks = split_into_chunks(pages)

    model = get_embedding_model()
    collection = get_collection()

    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=False).tolist()

    ids = [
        f"doc{document_id}_chunk{c['chunk_index']}"
        for c in chunks
    ]
    metadatas = [
        {
            "document_id": document_id,
            "subject_id": subject_id,
            "original_name": original_name,
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
        }
        for c in chunks
    ]

    # Delete any previous chunks for this document
    try:
        existing = collection.get(where={"document_id": document_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )
    return len(chunks)


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def retrieve_relevant_chunks(
    query: str,
    document_ids: Optional[List[int]] = None,
    subject_id: Optional[int] = None,
    top_k: int = 6,
) -> List[Dict[str, Any]]:
    """
    Embed query and retrieve the top_k most similar chunks.
    Filter by document_ids or subject_id if provided.
    Returns list of {text, score, document_id, original_name, page_number}.
    """
    model = get_embedding_model()
    collection = get_collection()

    query_embedding = model.encode([query])[0].tolist()

    where_filter: Optional[Dict] = None
    if document_ids:
        if len(document_ids) == 1:
            where_filter = {"document_id": document_ids[0]}
        else:
            where_filter = {"document_id": {"$in": document_ids}}
    elif subject_id:
        where_filter = {"subject_id": subject_id}

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"] or not results["ids"][0]:
        return []

    chunks = []
    for i, doc_text in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        distance = results["distances"][0][i]
        # cosine distance → similarity
        similarity = 1.0 - distance
        chunks.append({
            "text": doc_text,
            "score": round(similarity, 4),
            "document_id": meta.get("document_id"),
            "original_name": meta.get("original_name", "Unknown"),
            "page_number": meta.get("page_number", 0),
        })
    return sorted(chunks, key=lambda x: x["score"], reverse=True)


# ---------------------------------------------------------------------------
# Delete document chunks
# ---------------------------------------------------------------------------

def delete_document_chunks(document_id: int) -> None:
    collection = get_collection()
    try:
        existing = collection.get(where={"document_id": document_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception as exc:
        logger.warning("Could not delete chunks for doc %d: %s", document_id, exc)
