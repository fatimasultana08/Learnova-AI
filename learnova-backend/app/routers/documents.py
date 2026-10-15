"""
Document upload and RAG ingestion endpoint.
PDF files are processed asynchronously via a background task.
"""
import os
import uuid
import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.rag import UPLOAD_DIR, MAX_FILE_SIZE_MB, index_document, delete_document_chunks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_MIME = {"application/pdf"}
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def _process_document(document_id: int, subject_id: int, original_name: str, file_path: Path):
    """Background task: ingest PDF into vector store."""
    from app.database import SessionLocal
    import traceback as _tb

    db = SessionLocal()
    try:
        doc = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not doc:
            return
        doc.status = "processing"
        db.commit()

        # Ensure absolute path
        abs_path = Path(file_path).resolve()
        chunk_count = index_document(document_id, subject_id, original_name, abs_path)

        doc.status = "ready"
        doc.chunk_count = chunk_count
        db.commit()
        logger.info("Document %d indexed with %d chunks.", document_id, chunk_count)
    except Exception as exc:
        full_tb = _tb.format_exc()
        logger.error("Document processing error (doc %d): %s\n%s", document_id, exc, full_tb)
        # Use the existing db session — do not create a new one in the except block
        try:
            doc = db.query(models.Document).filter(models.Document.id == document_id).first()
            if doc:
                doc.status = "error"
                doc.error_message = f"{exc} | {full_tb[-300:]}"
                db.commit()
        except Exception as inner:
            logger.error("Could not record error for doc %d: %s", document_id, inner)
    finally:
        db.close()


@router.post("", response_model=schemas.DocumentOut, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    subject_id: int = Form(...),
    chapter_id: int = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validate file type
    if file.content_type not in ALLOWED_MIME and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    # Validate subject exists
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Save file — use absolute path to avoid CWD sensitivity in background tasks
    safe_name = f"{uuid.uuid4().hex}.pdf"
    file_path = UPLOAD_DIR.resolve() / safe_name
    with open(file_path, "wb") as f:
        f.write(content)

    # Detect page count (use stream mode to avoid Windows path issues)
    try:
        import pymupdf
        doc_fitz = pymupdf.open(stream=content, filetype="pdf")
        page_count = len(doc_fitz)
        doc_fitz.close()
    except Exception:
        page_count = None

    doc = models.Document(
        subject_id=subject_id,
        chapter_id=chapter_id,
        filename=safe_name,
        original_name=file.filename or safe_name,
        file_path=str(file_path),
        file_size=len(content),
        page_count=page_count,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(
        _process_document,
        doc.id,
        subject_id,
        file.filename or safe_name,
        file_path,
    )

    return doc


@router.get("/subject/{subject_id}", response_model=List[schemas.DocumentOut])
def list_documents(subject_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Document)
        .filter(models.Document.subject_id == subject_id)
        .order_by(models.Document.created_at.desc())
        .all()
    )


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    delete_document_chunks(doc.id)
    # Remove physical file
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(doc)
    db.commit()
