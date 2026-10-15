from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta, date

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=List[schemas.StudySessionOut])
def list_sessions(
    subject_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.StudySession)
    if subject_id:
        q = q.filter(models.StudySession.subject_id == subject_id)
    if date_from:
        q = q.filter(models.StudySession.created_at >= date_from)
    if date_to:
        q = q.filter(models.StudySession.created_at <= date_to)
    return q.order_by(models.StudySession.created_at.desc()).all()


@router.post("", response_model=schemas.StudySessionOut, status_code=201)
def create_session(data: schemas.StudySessionCreate, db: Session = Depends(get_db)):
    session = models.StudySession(
        **data.model_dump(),
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=schemas.StudySessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


@router.put("/{session_id}", response_model=schemas.StudySessionOut)
def update_session(session_id: int, data: schemas.StudySessionUpdate, db: Session = Depends(get_db)):
    s = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    if data.completed and not s.ended_at:
        s.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()


@router.get("/analytics/summary")
def session_summary(db: Session = Depends(get_db)):
    """Daily + weekly study time summary for analytics."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())

    today_minutes = db.query(func.sum(models.StudySession.actual_minutes)).filter(
        models.StudySession.completed == True,
        models.StudySession.created_at >= today_start,
    ).scalar() or 0.0

    week_minutes = db.query(func.sum(models.StudySession.actual_minutes)).filter(
        models.StudySession.completed == True,
        models.StudySession.created_at >= week_start,
    ).scalar() or 0.0

    # Study streak — consecutive days with at least one completed session
    streak = 0
    check_date = today_start
    while True:
        next_date = check_date + timedelta(days=1)
        count = db.query(func.count(models.StudySession.id)).filter(
            models.StudySession.completed == True,
            models.StudySession.created_at >= check_date,
            models.StudySession.created_at < next_date,
        ).scalar()
        if count and count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Per-subject breakdown (last 7 days)
    subject_breakdown = []
    subjects = db.query(models.Subject).filter(models.Subject.archived == False).all()
    for subj in subjects:
        mins = db.query(func.sum(models.StudySession.actual_minutes)).filter(
            models.StudySession.subject_id == subj.id,
            models.StudySession.completed == True,
            models.StudySession.created_at >= week_start,
        ).scalar() or 0.0
        subject_breakdown.append({
            "subject_id": subj.id,
            "subject_name": subj.name,
            "color": subj.color,
            "minutes": float(mins),
        })

    # Daily breakdown for last 7 days
    daily = []
    for offset in range(6, -1, -1):
        d_start = today_start - timedelta(days=offset)
        d_end = d_start + timedelta(days=1)
        mins = db.query(func.sum(models.StudySession.actual_minutes)).filter(
            models.StudySession.completed == True,
            models.StudySession.created_at >= d_start,
            models.StudySession.created_at < d_end,
        ).scalar() or 0.0
        daily.append({
            "date": d_start.strftime("%a"),
            "minutes": float(mins),
        })

    return {
        "today_minutes": float(today_minutes),
        "week_minutes": float(week_minutes),
        "streak_days": streak,
        "subject_breakdown": subject_breakdown,
        "daily_breakdown": daily,
    }
