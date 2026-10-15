"""
Quiz generation and attempt management.
"""
import json
import logging
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models, schemas
from app.rag import retrieve_relevant_chunks
from app.ai_provider import generate_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


def _quiz_prompt(topic: str, chunks: list, num_q: int, difficulty: str, qtypes: list, include_explanations: bool) -> str:
    context_parts = [f"[Page {c['page_number']}] {c['text']}" for c in chunks]
    context = "\n\n".join(context_parts[:6])
    types_str = ", ".join(qtypes)

    return f"""You are a quiz generator. Using ONLY the source material below, generate exactly {num_q} questions about: {topic}.
Difficulty: {difficulty}. Question types: {types_str}.

SOURCE MATERIAL:
{context}

Generate a JSON array with this exact structure:
[
  {{
    "question_text": "...",
    "question_type": "mcq",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_answer": "A. ...",
    "explanation": "...",
    "source_reference": "page X"
  }}
]

For true_false: options=["True","False"], correct_answer="True" or "False".
For fill_blank: question_text contains ___, correct_answer is the word(s).
For short_answer: options=null.
{"Include explanation for each question." if include_explanations else "Leave explanation as empty string."}
Respond with ONLY the JSON array. No markdown, no extra text."""


def _parse_quiz_json(raw: str) -> list:
    """Extract and parse JSON array from LLM output."""
    # Try to find JSON array
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # If dev mode sample response, return sample questions
    if "[DEV MODE" in raw or "sample response" in raw.lower():
        return [
            {
                "question_text": "What is Exception Handling in Java?",
                "question_type": "mcq",
                "options": [
                    "A. A mechanism to handle runtime errors",
                    "B. A way to declare variables",
                    "C. A loop construct",
                    "D. A sorting algorithm",
                ],
                "correct_answer": "A. A mechanism to handle runtime errors",
                "explanation": "Exception handling provides a way to transfer control when errors occur.",
                "source_reference": "[DEV MODE — sample question]",
            },
            {
                "question_text": "The 'finally' block always executes after try/catch.",
                "question_type": "true_false",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": "The finally block executes regardless of whether an exception occurred.",
                "source_reference": "[DEV MODE — sample question]",
            },
        ]
    raise ValueError(f"Could not parse quiz JSON from AI response: {raw[:300]}")


@router.post("", response_model=schemas.QuizOut, status_code=201)
async def create_quiz(data: schemas.QuizCreate, db: Session = Depends(get_db)):
    # Build topic string
    subj = db.query(models.Subject).filter(models.Subject.id == data.subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapter_title = ""
    if data.chapter_id:
        ch = db.query(models.Chapter).filter(models.Chapter.id == data.chapter_id).first()
        if ch:
            chapter_title = ch.title

    topic = f"{subj.name}" + (f" — {chapter_title}" if chapter_title else "")

    # Retrieve context
    doc_ids = data.document_ids
    if not doc_ids and data.chapter_id:
        ch_docs = db.query(models.Document).filter(
            models.Document.chapter_id == data.chapter_id,
            models.Document.status == "ready",
        ).all()
        doc_ids = [d.id for d in ch_docs]
    if not doc_ids:
        subj_docs = db.query(models.Document).filter(
            models.Document.subject_id == data.subject_id,
            models.Document.status == "ready",
        ).all()
        doc_ids = [d.id for d in subj_docs]

    chunks = []
    if doc_ids:
        chunks = retrieve_relevant_chunks(
            query=f"key concepts {topic}",
            document_ids=doc_ids,
            top_k=8,
        )

    if not chunks:
        # Generate from general knowledge with a warning
        prompt = f"""Generate exactly {data.num_questions} quiz questions about "{topic}".
Difficulty: {data.difficulty}. Types: {', '.join(data.question_types)}.
Return ONLY a JSON array with fields: question_text, question_type, options (list or null), correct_answer, explanation, source_reference.
source_reference should be "[General knowledge — no documents provided]"."""
    else:
        prompt = _quiz_prompt(
            topic, chunks, data.num_questions, data.difficulty,
            data.question_types, data.include_explanations
        )

    result = await generate_text(prompt, max_tokens=2000)

    try:
        questions_data = _parse_quiz_json(result["text"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Persist quiz
    quiz = models.Quiz(
        subject_id=data.subject_id,
        chapter_id=data.chapter_id,
        title=data.title,
        difficulty=data.difficulty,
        question_types=data.question_types,
        timed=data.timed,
        time_limit_minutes=data.time_limit_minutes,
        total_questions=len(questions_data),
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    for i, qd in enumerate(questions_data):
        q = models.Question(
            quiz_id=quiz.id,
            question_text=qd.get("question_text", ""),
            question_type=qd.get("question_type", "mcq"),
            options=qd.get("options"),
            correct_answer=str(qd.get("correct_answer", "")),
            explanation=qd.get("explanation", ""),
            source_reference=qd.get("source_reference", ""),
            order_index=i,
        )
        db.add(q)
    db.commit()
    db.refresh(quiz)

    # Eager-load questions
    quiz.questions  # trigger lazy load
    return quiz


@router.get("", response_model=List[schemas.QuizOut])
def list_quizzes(subject_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Quiz)
    if subject_id:
        q = q.filter(models.Quiz.subject_id == subject_id)
    return q.order_by(models.Quiz.created_at.desc()).all()


@router.get("/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()


@router.post("/{quiz_id}/attempts", response_model=schemas.QuizAttemptOut, status_code=201)
def submit_attempt(quiz_id: int, data: schemas.QuizAttemptCreate, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Auto-score objective questions
    correct_count = 0
    total = 0
    for q in quiz.questions:
        if q.question_type in ("mcq", "true_false", "fill_blank"):
            total += 1
            user_ans = str(data.answers.get(str(q.id), "")).strip().lower()
            correct_ans = q.correct_answer.strip().lower()
            if user_ans == correct_ans:
                correct_count += 1

    score = round((correct_count / total * 100), 1) if total > 0 else None

    attempt = models.QuizAttempt(
        quiz_id=quiz_id,
        score=score,
        answers=data.answers,
        time_taken_seconds=data.time_taken_seconds,
        completed=True,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/{quiz_id}/attempts", response_model=List[schemas.QuizAttemptOut])
def list_attempts(quiz_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.quiz_id == quiz_id)
        .order_by(models.QuizAttempt.created_at.desc())
        .all()
    )


@router.post("/questions/{question_id}/flag", status_code=200)
def flag_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.flagged = not q.flagged
    db.commit()
    return {"flagged": q.flagged}
