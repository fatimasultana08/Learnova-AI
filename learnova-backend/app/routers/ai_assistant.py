"""
AI Study Assistant — RAG-powered Q&A and study actions.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.rag import retrieve_relevant_chunks
from app.ai_provider import generate_text, provider_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

RELEVANCE_THRESHOLD = 0.25   # minimum cosine similarity to treat a chunk as supporting evidence


def _build_rag_prompt(question: str, chunks: list, action: Optional[str] = None) -> str:
    context_parts = []
    for i, c in enumerate(chunks, 1):
        context_parts.append(
            f"[Source {i}: {c['original_name']}, page {c['page_number']}]\n{c['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    action_instruction = {
        "explain": "Explain the concept clearly in simple language.",
        "explain_exam": "Explain the topic in exam-ready, precise academic language.",
        "summarize": "Summarize the main points of the provided material.",
        "notes": "Generate concise revision notes as bullet points.",
        "definitions": "Extract and list all important definitions, formulas, and key terms.",
        "short_questions": "Generate 5 short-answer questions with model answers.",
        "long_questions": "Generate 3 long-answer questions with detailed model answers.",
        "flashcards": "Create 8 flashcard pairs in the format: FRONT: ... | BACK: ...",
        "compare": "Create a comparison table of the main concepts discussed.",
        "checklist": "Create a revision checklist with checkboxes for each important topic.",
    }.get(action or "", "Answer the student's question accurately.")

    return f"""You are an expert academic tutor. Use ONLY the following source passages to answer the question. 
If the passages do not contain sufficient information to answer, say exactly: "The uploaded material does not provide sufficient information to answer this question."
Do NOT fabricate facts, citations, or page numbers.
{action_instruction}

=== SOURCE PASSAGES ===
{context}

=== QUESTION ===
{question}

=== ANSWER ==="""


def _build_general_prompt(question: str, action: Optional[str] = None) -> str:
    action_instruction = {
        "explain": "Explain the concept clearly in simple language.",
        "explain_exam": "Explain in exam-ready academic language.",
        "summarize": "Provide a structured summary.",
        "notes": "Generate concise revision notes.",
        "definitions": "List important definitions and key terms.",
    }.get(action or "", "Answer the student's academic question.")

    return f"""You are an expert academic tutor answering from general knowledge (no document context).
{action_instruction}

Question: {question}

Answer:"""


@router.post("/chat", response_model=schemas.ChatMessageOut)
async def chat(request: schemas.ChatRequest, db: Session = Depends(get_db)):
    # Validate referenced documents exist and are ready
    doc_ids = request.document_ids or []
    if doc_ids:
        docs = db.query(models.Document).filter(models.Document.id.in_(doc_ids)).all()
        not_ready = [d.original_name for d in docs if d.status != "ready"]
        if not_ready:
            raise HTTPException(
                status_code=400,
                detail=f"Documents not yet processed: {', '.join(not_ready)}. Please wait.",
            )

    # Retrieve relevant chunks
    chunks = []
    if doc_ids or request.subject_id:
        chunks = retrieve_relevant_chunks(
            query=request.question,
            document_ids=doc_ids or None,
            subject_id=request.subject_id if not doc_ids else None,
            top_k=6,
        )

    relevant_chunks = [c for c in chunks if c["score"] >= RELEVANCE_THRESHOLD]

    # Build prompt
    if relevant_chunks:
        prompt = _build_rag_prompt(request.question, relevant_chunks, request.action)
        grounded = True
    else:
        # No supporting evidence — inform the student
        insufficient_msg = (
            "The uploaded material does not provide sufficient information to answer this question. "
            "Would you like a general answer based on my training knowledge instead? "
            "(Reply 'yes' and I'll answer from general knowledge, clearly labelled.)"
        )
        # Check if this is a follow-up asking for general answer
        if request.question.strip().lower() in ("yes", "yes please", "yes, please", "y"):
            # Use last question from session as context — simplified: just use general
            prompt = _build_general_prompt(request.question, request.action)
            grounded = False
        else:
            # Save insufficient-evidence message directly
            sources = []
            msg = models.ChatMessage(
                session_id=request.session_id,
                role="assistant",
                content=insufficient_msg,
                sources=sources,
                subject_id=request.subject_id,
                document_ids=doc_ids,
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)
            return msg

    result = await generate_text(prompt, max_tokens=1200)

    sources = []
    if grounded:
        for c in relevant_chunks:
            sources.append({
                "document_name": c["original_name"],
                "page": c["page_number"],
                "score": c["score"],
                "excerpt": c["text"][:200] + ("…" if len(c["text"]) > 200 else ""),
            })

    # Prepend dev warning if applicable
    answer_text = result["text"]
    if result.get("is_dev"):
        answer_text = f"⚠️ **Dev Mode** — No AI credentials configured.\n\n{answer_text}"
    elif not grounded:
        answer_text = f"ℹ️ *General knowledge answer (not from your documents):*\n\n{answer_text}"

    # Persist user message
    user_msg = models.ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.question,
        sources=None,
        subject_id=request.subject_id,
        document_ids=doc_ids,
    )
    db.add(user_msg)

    # Persist assistant message
    asst_msg = models.ChatMessage(
        session_id=request.session_id,
        role="assistant",
        content=answer_text,
        sources=sources,
        subject_id=request.subject_id,
        document_ids=doc_ids,
    )
    db.add(asst_msg)
    db.commit()
    db.refresh(asst_msg)
    return asst_msg


@router.get("/chat/history/{session_id}", response_model=List[schemas.ChatMessageOut])
def get_history(session_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at)
        .all()
    )


@router.get("/provider/status")
def get_provider_status():
    return provider_status()


@router.post("/generate-notes")
async def generate_notes(
    chapter_id: int,
    document_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
):
    """Generate structured chapter notes from uploaded documents."""
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if not document_ids:
        doc_ids_from_ch = [d.id for d in ch.documents if d.status == "ready"]
    else:
        doc_ids_from_ch = document_ids

    if not doc_ids_from_ch:
        raise HTTPException(
            status_code=400,
            detail="No processed documents found for this chapter. Upload and process a PDF first.",
        )

    chunks = retrieve_relevant_chunks(
        query=f"key concepts and topics in {ch.title}",
        document_ids=doc_ids_from_ch,
        top_k=8,
    )

    if not chunks:
        raise HTTPException(status_code=422, detail="No relevant content found in documents.")

    prompt = _build_rag_prompt(
        f"Generate comprehensive revision notes for the chapter: {ch.title}",
        chunks,
        "notes",
    )
    result = await generate_text(prompt, max_tokens=1500)

    # Save notes back to chapter
    ch.notes = result["text"]
    from datetime import datetime
    ch.updated_at = datetime.utcnow()
    db.commit()

    return {
        "chapter_id": chapter_id,
        "notes": result["text"],
        "provider": result["provider"],
        "is_dev": result.get("is_dev", False),
    }
