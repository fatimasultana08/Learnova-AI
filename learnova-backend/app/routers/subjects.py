from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


def _enrich_subject(subject: models.Subject, db: Session) -> schemas.SubjectOut:
    chapter_count = len(subject.chapters)
    completed = sum(1 for c in subject.chapters if c.status == "completed")
    total_minutes = db.query(func.sum(models.StudySession.actual_minutes)).filter(
        models.StudySession.subject_id == subject.id,
        models.StudySession.completed == True,
    ).scalar() or 0.0

    out = schemas.SubjectOut.model_validate(subject)
    out.chapter_count = chapter_count
    out.completed_chapters = completed
    out.total_study_minutes = float(total_minutes)
    return out


@router.get("", response_model=List[schemas.SubjectOut])
def list_subjects(archived: Optional[bool] = False, db: Session = Depends(get_db)):
    q = db.query(models.Subject)
    if archived is not None:
        q = q.filter(models.Subject.archived == archived)
    subjects = q.order_by(models.Subject.created_at).all()
    return [_enrich_subject(s, db) for s in subjects]


@router.post("", response_model=schemas.SubjectOut, status_code=201)
def create_subject(data: schemas.SubjectCreate, db: Session = Depends(get_db)):
    subj = models.Subject(**data.model_dump())
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return _enrich_subject(subj, db)


@router.get("/{subject_id}", response_model=schemas.SubjectOut)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _enrich_subject(subj, db)


@router.put("/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(subject_id: int, data: schemas.SubjectUpdate, db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(subj, field, val)
    subj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(subj)
    return _enrich_subject(subj, db)


@router.delete("/{subject_id}", status_code=204)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    # Remove vector chunks for all documents belonging to this subject
    from app.rag import delete_document_chunks
    for doc in subj.documents:
        try:
            delete_document_chunks(doc.id)
        except Exception:
            pass
    db.delete(subj)
    db.commit()
