"""
Pydantic schemas for request/response validation.
"""
from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from datetime import datetime


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------

class SubjectCreate(BaseModel):
    name: str
    color: str = "#3b82f6"
    icon: str = "book"
    target_grade: Optional[str] = None
    exam_date: Optional[datetime] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    target_grade: Optional[str] = None
    exam_date: Optional[datetime] = None
    archived: Optional[bool] = None


class SubjectOut(BaseModel):
    id: int
    name: str
    color: str
    icon: str
    target_grade: Optional[str]
    exam_date: Optional[datetime]
    archived: bool
    created_at: datetime
    chapter_count: int = 0
    completed_chapters: int = 0
    total_study_minutes: float = 0

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Chapter
# ---------------------------------------------------------------------------

class ChapterCreate(BaseModel):
    subject_id: int
    title: str
    order_index: int = 0
    status: str = "not_started"
    difficulty: str = "medium"
    confidence: int = 50
    notes: str = ""


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None
    status: Optional[str] = None
    difficulty: Optional[str] = None
    confidence: Optional[int] = None
    notes: Optional[str] = None


class ChapterOut(BaseModel):
    id: int
    subject_id: int
    title: str
    order_index: int
    status: str
    difficulty: str
    confidence: int
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------

class DocumentOut(BaseModel):
    id: int
    subject_id: int
    chapter_id: Optional[int]
    filename: str
    original_name: str
    file_size: Optional[int]
    page_count: Optional[int]
    status: str
    error_message: Optional[str]
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Quiz
# ---------------------------------------------------------------------------

class QuizCreate(BaseModel):
    subject_id: int
    chapter_id: Optional[int] = None
    title: str
    difficulty: str = "medium"
    question_types: List[str] = ["mcq"]
    num_questions: int = 5
    timed: bool = False
    time_limit_minutes: Optional[int] = None
    document_ids: Optional[List[int]] = None
    include_explanations: bool = True


class QuestionOut(BaseModel):
    id: int
    quiz_id: int
    question_text: str
    question_type: str
    options: Optional[List[str]]
    correct_answer: str
    explanation: Optional[str]
    source_reference: Optional[str]
    flagged: bool
    order_index: int

    model_config = {"from_attributes": True}


class QuizOut(BaseModel):
    id: int
    subject_id: int
    chapter_id: Optional[int]
    title: str
    difficulty: str
    question_types: List[str]
    timed: bool
    time_limit_minutes: Optional[int]
    total_questions: int
    created_at: datetime
    questions: List[QuestionOut] = []

    model_config = {"from_attributes": True}


class QuizAttemptCreate(BaseModel):
    answers: Dict[str, Any]
    time_taken_seconds: Optional[int] = None


class QuizAttemptOut(BaseModel):
    id: int
    quiz_id: int
    score: Optional[float]
    answers: Dict[str, Any]
    time_taken_seconds: Optional[int]
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# StudySession
# ---------------------------------------------------------------------------

class StudySessionCreate(BaseModel):
    subject_id: Optional[int] = None
    chapter_id: Optional[int] = None
    task_id: Optional[int] = None
    mode: str = "pomodoro"
    planned_minutes: int = 25
    notes: str = ""


class StudySessionUpdate(BaseModel):
    actual_minutes: Optional[float] = None
    completed: Optional[bool] = None
    notes: Optional[str] = None
    ended_at: Optional[datetime] = None


class StudySessionOut(BaseModel):
    id: int
    subject_id: Optional[int]
    chapter_id: Optional[int]
    task_id: Optional[int]
    mode: str
    planned_minutes: int
    actual_minutes: float
    completed: bool
    notes: str
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# CalendarEvent
# ---------------------------------------------------------------------------

class CalendarEventCreate(BaseModel):
    title: str
    category: str = "exam"
    subject_id: Optional[int] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    all_day: bool = True
    priority: str = "medium"
    notes: str = ""
    reminder_minutes: Optional[int] = None
    color: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    subject_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    all_day: Optional[bool] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    reminder_minutes: Optional[int] = None
    color: Optional[str] = None


class CalendarEventOut(BaseModel):
    id: int
    title: str
    category: str
    subject_id: Optional[int]
    start_date: datetime
    end_date: Optional[datetime]
    all_day: bool
    priority: str
    notes: str
    reminder_minutes: Optional[int]
    color: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    subject_id: Optional[int] = None
    chapter_id: Optional[int] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"
    status: str = "todo"
    task_type: str = "general"
    estimated_minutes: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    task_type: Optional[str] = None
    estimated_minutes: Optional[int] = None
    completed_at: Optional[datetime] = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    subject_id: Optional[int]
    chapter_id: Optional[int]
    due_date: Optional[datetime]
    priority: str
    status: str
    task_type: str
    estimated_minutes: Optional[int]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Course
# ---------------------------------------------------------------------------

class CourseCreate(BaseModel):
    title: str
    provider: Optional[str] = None
    description: str = ""
    url: Optional[str] = None
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    learning_goals: str = ""
    weekly_target_hours: float = 2.0


class CourseLessonCreate(BaseModel):
    module_id: int
    title: str
    url: Optional[str] = None
    status: str = "not_started"
    notes: str = ""
    order_index: int = 0


class CourseModuleCreate(BaseModel):
    course_id: int
    title: str
    order_index: int = 0


class CourseLessonOut(BaseModel):
    id: int
    module_id: int
    title: str
    url: Optional[str]
    status: str
    notes: str
    order_index: int
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CourseModuleOut(BaseModel):
    id: int
    course_id: int
    title: str
    order_index: int
    lessons: List[CourseLessonOut] = []

    model_config = {"from_attributes": True}


class CourseOut(BaseModel):
    id: int
    title: str
    provider: Optional[str]
    description: str
    url: Optional[str]
    start_date: Optional[datetime]
    target_end_date: Optional[datetime]
    learning_goals: str
    status: str
    weekly_target_hours: float
    created_at: datetime
    modules: List[CourseModuleOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    category: str
    link: Optional[str]
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class SettingsUpdate(BaseModel):
    student_name: Optional[str] = None
    theme: Optional[str] = None
    pomodoro_focus_minutes: Optional[int] = None
    pomodoro_short_break: Optional[int] = None
    pomodoro_long_break: Optional[int] = None
    daily_study_goal_minutes: Optional[int] = None
    onboarding_done: Optional[bool] = None
    preferred_study_times: Optional[List[str]] = None


class SettingsOut(BaseModel):
    id: int
    student_name: str
    theme: str
    pomodoro_focus_minutes: int
    pomodoro_short_break: int
    pomodoro_long_break: int
    daily_study_goal_minutes: int
    onboarding_done: bool
    preferred_study_times: List[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# AI / Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    question: str
    session_id: str
    subject_id: Optional[int] = None
    document_ids: Optional[List[int]] = None
    action: Optional[str] = None   # explain | summarize | quiz_gen | notes | flashcards | definitions


class ChatMessageOut(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    sources: Optional[List[Dict[str, Any]]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_study_minutes_today: float
    total_study_minutes_week: float
    total_subjects: int
    total_chapters: int
    completed_chapters: int
    upcoming_exams: List[Dict[str, Any]]
    recent_quiz_scores: List[Dict[str, Any]]
    study_streak_days: int
    pending_tasks: int
    overdue_tasks: int
