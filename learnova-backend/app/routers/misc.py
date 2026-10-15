"""
Analytics, notifications, settings, courses, and ML endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app import models, schemas

# ─── Analytics ──────────────────────────────────────────────────────────────

analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@analytics_router.get("/dashboard", response_model=schemas.DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
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

    # Study streak
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

    total_subjects = db.query(func.count(models.Subject.id)).filter(
        models.Subject.archived == False
    ).scalar() or 0

    total_chapters = db.query(func.count(models.Chapter.id)).scalar() or 0
    completed_chapters = db.query(func.count(models.Chapter.id)).filter(
        models.Chapter.status == "completed"
    ).scalar() or 0

    # Upcoming exams (next 30 days)
    upcoming_exams = []
    exams = (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.category == "exam",
            models.CalendarEvent.start_date >= now,
            models.CalendarEvent.start_date <= now + timedelta(days=30),
        )
        .order_by(models.CalendarEvent.start_date)
        .limit(5)
        .all()
    )
    for e in exams:
        days_left = (e.start_date - now).days
        upcoming_exams.append({
            "id": e.id,
            "title": e.title,
            "date": e.start_date.isoformat(),
            "days_left": days_left,
            "subject_id": e.subject_id,
        })

    # Recent quiz scores
    recent_attempts = (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.completed == True)
        .order_by(models.QuizAttempt.created_at.desc())
        .limit(5)
        .all()
    )
    recent_scores = [
        {
            "quiz_id": a.quiz_id,
            "score": a.score,
            "date": a.created_at.isoformat(),
        }
        for a in recent_attempts
    ]

    pending_tasks = db.query(func.count(models.Task.id)).filter(
        models.Task.status.in_(["todo", "in_progress"])
    ).scalar() or 0
    overdue_tasks = db.query(func.count(models.Task.id)).filter(
        models.Task.status == "overdue"
    ).scalar() or 0

    return schemas.DashboardStats(
        total_study_minutes_today=float(today_minutes),
        total_study_minutes_week=float(week_minutes),
        total_subjects=total_subjects,
        total_chapters=total_chapters,
        completed_chapters=completed_chapters,
        upcoming_exams=upcoming_exams,
        recent_quiz_scores=recent_scores,
        study_streak_days=streak,
        pending_tasks=pending_tasks,
        overdue_tasks=overdue_tasks,
    )


# ─── Notifications ───────────────────────────────────────────────────────────

notif_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@notif_router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(models.Notification)
    if unread_only:
        q = q.filter(models.Notification.read == False)
    return q.order_by(models.Notification.created_at.desc()).limit(50).all()


@notif_router.post("/{notif_id}/read", status_code=200)
def mark_read(notif_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@notif_router.post("/read-all", status_code=200)
def mark_all_read(db: Session = Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.read == False).update({"read": True})
    db.commit()
    return {"ok": True}


@notif_router.delete("/{notif_id}", status_code=204)
def delete_notification(notif_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()


def _generate_warnings(db: Session):
    """Generate actionable notifications based on current app state."""
    now = datetime.utcnow()
    new_notifs = []

    # Exams within 7 days with incomplete chapters
    upcoming = (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.category == "exam",
            models.CalendarEvent.start_date >= now,
            models.CalendarEvent.start_date <= now + timedelta(days=7),
        )
        .all()
    )
    for exam in upcoming:
        if exam.subject_id:
            incomplete = db.query(func.count(models.Chapter.id)).filter(
                models.Chapter.subject_id == exam.subject_id,
                models.Chapter.status != "completed",
            ).scalar() or 0
            if incomplete > 0:
                days_left = (exam.start_date - now).days
                title = f"⚠️ Exam in {days_left} day(s): {exam.title}"
                body = f"You have {incomplete} incomplete chapter(s). Review your study plan."
                existing = db.query(models.Notification).filter(
                    models.Notification.title == title
                ).first()
                if not existing:
                    new_notifs.append(models.Notification(
                        title=title, body=body, category="warning",
                        link="/calendar"
                    ))

    # Overdue tasks
    overdue = db.query(func.count(models.Task.id)).filter(
        models.Task.status == "overdue"
    ).scalar() or 0
    if overdue > 0:
        title = f"📋 {overdue} overdue task(s)"
        body = "You have tasks past their due date. Check your planner."
        existing = db.query(models.Notification).filter(
            models.Notification.title == title
        ).first()
        if not existing:
            new_notifs.append(models.Notification(
                title=title, body=body, category="danger",
                link="/tasks"
            ))

    for n in new_notifs:
        db.add(n)
    db.commit()


@notif_router.post("/refresh-warnings", status_code=200)
def refresh_warnings(db: Session = Depends(get_db)):
    _generate_warnings(db)
    return {"ok": True}


# ─── Settings ────────────────────────────────────────────────────────────────

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    s = db.query(models.Settings).filter(models.Settings.id == 1).first()
    if not s:
        s = models.Settings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@settings_router.put("", response_model=schemas.SettingsOut)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    s = db.query(models.Settings).filter(models.Settings.id == 1).first()
    if not s:
        s = models.Settings(id=1)
        db.add(s)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return s


# ─── Courses ─────────────────────────────────────────────────────────────────

courses_router = APIRouter(prefix="/api/courses", tags=["courses"])


@courses_router.get("", response_model=List[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).order_by(models.Course.created_at.desc()).all()


@courses_router.post("", response_model=schemas.CourseOut, status_code=201)
def create_course(data: schemas.CourseCreate, db: Session = Depends(get_db)):
    course = models.Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@courses_router.get("/{course_id}", response_model=schemas.CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


@courses_router.delete("/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(c)
    db.commit()


@courses_router.post("/modules", response_model=schemas.CourseModuleOut, status_code=201)
def add_module(data: schemas.CourseModuleCreate, db: Session = Depends(get_db)):
    m = models.CourseModule(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@courses_router.post("/lessons", response_model=schemas.CourseLessonOut, status_code=201)
def add_lesson(data: schemas.CourseLessonCreate, db: Session = Depends(get_db)):
    lesson = models.CourseLesson(**data.model_dump())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@courses_router.put("/lessons/{lesson_id}", response_model=schemas.CourseLessonOut)
def update_lesson(lesson_id: int, status: str, db: Session = Depends(get_db)):
    lesson = db.query(models.CourseLesson).filter(models.CourseLesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.status = status
    if status == "completed" and not lesson.completed_at:
        lesson.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(lesson)
    return lesson


# ─── ML ──────────────────────────────────────────────────────────────────────

ml_router = APIRouter(prefix="/api/ml", tags=["ml"])


@ml_router.post("/train")
def train_ml_model(db: Session = Depends(get_db)):
    """Train / retrain the revision-priority classifier."""
    from app.ml_priority import train_model

    # Collect chapter analytics
    chapters = db.query(models.Chapter).all()
    real_data = []
    for ch in chapters:
        attempts = db.query(models.QuizAttempt).join(models.Quiz).filter(
            models.Quiz.chapter_id == ch.id
        ).all()
        correct = 0
        incorrect = 0
        for a in attempts:
            if a.score is not None:
                c = int(a.score / 100 * (a.quiz.total_questions or 1))
                correct += c
                incorrect += (a.quiz.total_questions or 1) - c

        days_since = 0
        if ch.updated_at:
            days_since = (datetime.utcnow() - ch.updated_at).days

        # Assign label based on current status (for supervised training)
        label_map = {"not_started": 2, "in_progress": 1, "completed": 0, "needs_revision": 2}
        label = label_map.get(ch.status, 1)

        real_data.append({
            "id": ch.id,
            "title": ch.title,
            "quiz_attempts": len(attempts),
            "correct_answers": correct,
            "incorrect_answers": incorrect,
            "days_since_revision": days_since,
            "confidence": ch.confidence,
            "status": ch.status,
            "label": label,
        })

    evaluation = train_model(real_data)
    return evaluation


@ml_router.get("/predict/{chapter_id}")
def predict_chapter(chapter_id: int, db: Session = Depends(get_db)):
    from app.ml_priority import predict_priority

    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    attempts = db.query(models.QuizAttempt).join(models.Quiz).filter(
        models.Quiz.chapter_id == chapter_id
    ).all()
    correct = sum(
        int(a.score / 100 * (a.quiz.total_questions or 1))
        for a in attempts if a.score is not None
    )
    total_q = sum((a.quiz.total_questions or 1) for a in attempts if a.score is not None)
    incorrect = total_q - correct
    days_since = (datetime.utcnow() - ch.updated_at).days if ch.updated_at else 0

    chapter_data = {
        "id": ch.id,
        "title": ch.title,
        "quiz_attempts": len(attempts),
        "correct_answers": correct,
        "incorrect_answers": incorrect,
        "days_since_revision": days_since,
        "confidence": ch.confidence,
        "status": ch.status,
    }
    return predict_priority(chapter_data)


@ml_router.get("/predict-all")
def predict_all_chapters(db: Session = Depends(get_db)):
    from app.ml_priority import predict_priority

    chapters = db.query(models.Chapter).all()
    results = []
    for ch in chapters:
        attempts = db.query(models.QuizAttempt).join(models.Quiz).filter(
            models.Quiz.chapter_id == ch.id
        ).all()
        correct = sum(
            int(a.score / 100 * (a.quiz.total_questions or 1))
            for a in attempts if a.score is not None
        )
        total_q = sum((a.quiz.total_questions or 1) for a in attempts if a.score is not None)
        incorrect = total_q - correct
        days_since = (datetime.utcnow() - ch.updated_at).days if ch.updated_at else 0

        chapter_data = {
            "id": ch.id,
            "title": ch.title,
            "quiz_attempts": len(attempts),
            "correct_answers": correct,
            "incorrect_answers": incorrect,
            "days_since_revision": days_since,
            "confidence": ch.confidence,
            "status": ch.status,
        }
        pred = predict_priority(chapter_data)
        pred["chapter_id"] = ch.id
        pred["chapter_title"] = ch.title
        pred["subject_id"] = ch.subject_id
        results.append(pred)

    return results
