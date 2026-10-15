"""
Learnova AI — FastAPI backend entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.database import init_db
from app.routers.subjects import router as subjects_router
from app.routers.chapters import router as chapters_router
from app.routers.documents import router as documents_router
from app.routers.ai_assistant import router as ai_router
from app.routers.quizzes import router as quizzes_router
from app.routers.calendar import router as calendar_router
from app.routers.tasks import router as tasks_router
from app.routers.sessions import router as sessions_router
from app.routers.misc import (
    analytics_router,
    notif_router,
    settings_router,
    courses_router,
    ml_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()
    # Ensure uploads/chroma directories exist
    Path("./uploads").mkdir(parents=True, exist_ok=True)
    Path("./chroma_db").mkdir(parents=True, exist_ok=True)
    logger.info("Learnova AI backend ready.")
    yield
    logger.info("Shutdown.")


app = FastAPI(
    title="Learnova AI",
    description="Intelligent Personal Study & Exam Management Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(subjects_router)
app.include_router(chapters_router)
app.include_router(documents_router)
app.include_router(ai_router)
app.include_router(quizzes_router)
app.include_router(calendar_router)
app.include_router(tasks_router)
app.include_router(sessions_router)
app.include_router(analytics_router)
app.include_router(notif_router)
app.include_router(settings_router)
app.include_router(courses_router)
app.include_router(ml_router)


@app.get("/api/health")
def health():
    from app.ai_provider import provider_status
    return {"status": "ok", "ai": provider_status()}
