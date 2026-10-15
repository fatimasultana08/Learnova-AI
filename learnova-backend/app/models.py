"""
Learnova AI — SQLAlchemy ORM models.
All models live in a single file to keep imports simple.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    color = Column(String(20), default="#3b82f6")
    icon = Column(String(50), default="book")
    target_grade = Column(String(20), nullable=True)
    exam_date = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapters = relationship("Chapter", back_populates="subject", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="subject", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="subject", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="subject", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="subject", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Chapter
# ---------------------------------------------------------------------------

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    title = Column(String(300), nullable=False)
    order_index = Column(Integer, default=0)
    status = Column(String(30), default="not_started")   # not_started | in_progress | completed | needs_revision
    difficulty = Column(String(20), default="medium")    # easy | medium | hard
    confidence = Column(Integer, default=50)             # 0-100
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("Subject", back_populates="chapters")
    documents = relationship("Document", back_populates="chapter", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="chapter", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="chapter", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="chapter", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Document (uploaded PDF)
# ---------------------------------------------------------------------------

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    filename = Column(String(300), nullable=False)
    original_name = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)          # bytes
    page_count = Column(Integer, nullable=True)
    status = Column(String(30), default="pending")     # pending | processing | ready | error
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="documents")
    chapter = relationship("Chapter", back_populates="documents")


# ---------------------------------------------------------------------------
# Quiz & Questions
# ---------------------------------------------------------------------------

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    title = Column(String(300), nullable=False)
    difficulty = Column(String(20), default="medium")
    question_types = Column(JSON, default=["mcq"])
    timed = Column(Boolean, default=False)
    time_limit_minutes = Column(Integer, nullable=True)
    total_questions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="quizzes")
    chapter = relationship("Chapter", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30), nullable=False)  # mcq | true_false | fill_blank | short_answer
    options = Column(JSON, nullable=True)               # list of option strings for MCQ
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    source_reference = Column(Text, nullable=True)      # doc name + page
    flagged = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    score = Column(Float, nullable=True)               # 0-100
    answers = Column(JSON, default={})                  # {question_id: user_answer}
    time_taken_seconds = Column(Integer, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    quiz = relationship("Quiz", back_populates="attempts")


# ---------------------------------------------------------------------------
# Study Session (focus timer)
# ---------------------------------------------------------------------------

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    mode = Column(String(30), default="pomodoro")      # pomodoro | stopwatch | custom
    planned_minutes = Column(Integer, default=25)
    actual_minutes = Column(Float, default=0)
    completed = Column(Boolean, default=False)
    notes = Column(Text, default="")
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="study_sessions")
    chapter = relationship("Chapter", back_populates="study_sessions")
    task = relationship("Task", back_populates="study_sessions")


# ---------------------------------------------------------------------------
# Calendar Event
# ---------------------------------------------------------------------------

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    category = Column(String(50), default="exam")      # exam | assignment | quiz | revision | reminder | personal
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    all_day = Column(Boolean, default=True)
    priority = Column(String(20), default="medium")
    notes = Column(Text, default="")
    reminder_minutes = Column(Integer, nullable=True)  # minutes before event
    recurring = Column(Boolean, default=False)
    recur_rule = Column(String(200), nullable=True)
    color = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject")


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    priority = Column(String(20), default="medium")    # low | medium | high
    status = Column(String(30), default="todo")        # todo | in_progress | completed | overdue
    task_type = Column(String(30), default="general")  # general | study | revision | assignment
    estimated_minutes = Column(Integer, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="tasks")
    chapter = relationship("Chapter", back_populates="tasks")
    study_sessions = relationship("StudySession", back_populates="task")


# ---------------------------------------------------------------------------
# Course (external / self-directed)
# ---------------------------------------------------------------------------

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    provider = Column(String(200), nullable=True)
    description = Column(Text, default="")
    url = Column(String(500), nullable=True)
    start_date = Column(DateTime, nullable=True)
    target_end_date = Column(DateTime, nullable=True)
    learning_goals = Column(Text, default="")
    status = Column(String(30), default="not_started")
    weekly_target_hours = Column(Float, default=2.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    modules = relationship("CourseModule", back_populates="course", cascade="all, delete-orphan")


class CourseModule(Base):
    __tablename__ = "course_modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(300), nullable=False)
    order_index = Column(Integer, default=0)

    course = relationship("Course", back_populates="modules")
    lessons = relationship("CourseLesson", back_populates="module", cascade="all, delete-orphan")


class CourseLesson(Base):
    __tablename__ = "course_lessons"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("course_modules.id"), nullable=False)
    title = Column(String(300), nullable=False)
    url = Column(String(500), nullable=True)
    status = Column(String(30), default="not_started")
    notes = Column(Text, default="")
    order_index = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)

    module = relationship("CourseModule", back_populates="lessons")


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    body = Column(Text, default="")
    category = Column(String(50), default="info")      # info | warning | danger | success
    link = Column(String(300), nullable=True)          # frontend route
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# App Settings (single row)
# ---------------------------------------------------------------------------

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    student_name = Column(String(200), default="Student")
    theme = Column(String(20), default="light")
    pomodoro_focus_minutes = Column(Integer, default=25)
    pomodoro_short_break = Column(Integer, default=5)
    pomodoro_long_break = Column(Integer, default=15)
    daily_study_goal_minutes = Column(Integer, default=120)
    onboarding_done = Column(Boolean, default=False)
    preferred_study_times = Column(JSON, default=["morning"])
    subjects_data = Column(JSON, default={})           # initial setup data
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# AI Chat History
# ---------------------------------------------------------------------------

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)          # user | assistant
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)              # [{doc_name, page, excerpt}]
    subject_id = Column(Integer, nullable=True)
    document_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
