from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=List[schemas.TaskOut])
def list_tasks(
    status: Optional[str] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Task)
    if status:
        q = q.filter(models.Task.status == status)
    if subject_id:
        q = q.filter(models.Task.subject_id == subject_id)

    tasks = q.order_by(models.Task.due_date.asc().nullslast(), models.Task.priority.desc()).all()

    # Auto-mark overdue
    now = datetime.utcnow()
    for task in tasks:
        if task.due_date and task.due_date < now and task.status not in ("completed", "overdue"):
            task.status = "overdue"
    db.commit()
    return tasks


@router.post("", response_model=schemas.TaskOut, status_code=201)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db)):
    task = models.Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = data.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(task, field, val)
    if task.status == "completed" and not task.completed_at:
        task.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


@router.post("/generate-plan", response_model=List[schemas.TaskOut])
def generate_study_plan(
    days_ahead: int = 7,
    daily_hours: float = 3.0,
    db: Session = Depends(get_db),
):
    """
    Auto-generate a study plan based on:
    - Upcoming exam events
    - Incomplete chapters
    - Existing task load
    Returns newly-created task objects.
    """
    now = datetime.utcnow()
    future = now + timedelta(days=days_ahead)

    # Find upcoming exams
    exams = (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.category == "exam",
            models.CalendarEvent.start_date >= now,
            models.CalendarEvent.start_date <= future + timedelta(days=30),
        )
        .order_by(models.CalendarEvent.start_date)
        .all()
    )

    # Find incomplete chapters
    incomplete_chapters = (
        db.query(models.Chapter)
        .filter(models.Chapter.status.in_(["not_started", "in_progress", "needs_revision"]))
        .order_by(models.Chapter.subject_id, models.Chapter.order_index)
        .all()
    )

    created_tasks = []
    # Distribute chapters across days
    minutes_per_day = int(daily_hours * 60)
    used_minutes: dict = {}  # date_str -> minutes used

    for ch in incomplete_chapters:
        estimated = 60 if ch.difficulty == "hard" else (45 if ch.difficulty == "medium" else 30)

        # Find best day
        best_day = None
        for offset in range(days_ahead):
            target_date = now + timedelta(days=offset + 1)
            date_str = target_date.strftime("%Y-%m-%d")
            used = used_minutes.get(date_str, 0)
            if used + estimated <= minutes_per_day:
                best_day = target_date
                used_minutes[date_str] = used + estimated
                break

        if not best_day:
            continue

        # Check for exam proximity — boost priority
        priority = "medium"
        for exam in exams:
            if exam.subject_id == ch.subject_id:
                days_to_exam = (exam.start_date - now).days
                if days_to_exam <= 3:
                    priority = "high"
                elif days_to_exam <= 7:
                    priority = "high"
                break

        task = models.Task(
            title=f"Study: {ch.title}",
            description=f"Complete chapter '{ch.title}' for subject #{ch.subject_id}.",
            subject_id=ch.subject_id,
            chapter_id=ch.id,
            due_date=best_day,
            priority=priority,
            status="todo",
            task_type="study",
            estimated_minutes=estimated,
        )
        db.add(task)
        created_tasks.append(task)

    db.commit()
    for t in created_tasks:
        db.refresh(t)

    return created_tasks
