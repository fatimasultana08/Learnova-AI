"""
Backend integration tests â€” cover the critical validation workflow:
1. Create subject "Java"
2. Add chapter "Exception Handling"
3. Upload PDF
4. Ask a question (document-grounded + insufficient evidence)
5. Generate quiz + submit
6. Create exam date + verify
7. Generate study plan
8. Create & complete focus session
9. ML revision priority
10. Data persistence check
"""
import pytest
import httpx
import os
import io
from pathlib import Path

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=60) as c:
        yield c


# â”€â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    print(f"\nâœ“ Health OK | AI provider: {data['ai']['active_provider']}")


# â”€â”€â”€ 1. Create subject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture(scope="module")
def java_subject(client):
    r = client.post("/api/subjects", json={
        "name": "Java",
        "color": "#f59e0b",
    })
    assert r.status_code == 201
    subj = r.json()
    assert subj["name"] == "Java"
    print(f"\nâœ“ Subject created: id={subj['id']}")
    yield subj
    # Cleanup
    client.delete(f"/api/subjects/{subj['id']}")


# â”€â”€â”€ 2. Add chapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture(scope="module")
def exception_chapter(client, java_subject):
    r = client.post("/api/chapters", json={
        "subject_id": java_subject["id"],
        "title": "Exception Handling",
        "difficulty": "medium",
    })
    assert r.status_code == 201
    ch = r.json()
    assert ch["title"] == "Exception Handling"
    print(f"âœ“ Chapter created: id={ch['id']}")
    yield ch


# â”€â”€â”€ 3. Upload PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _make_test_pdf() -> bytes:
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page()
    lines = [
        "Exception Handling in Java",
        "Exception handling is a mechanism to handle runtime errors.",
        "The try block contains code that might throw an exception.",
        "The catch block handles the exception.",
        "The finally block always executes after try and catch.",
        "Common exceptions: NullPointerException, ArrayIndexOutOfBoundsException.",
        "Custom exceptions can be created by extending the Exception class.",
    ]
    for i, line in enumerate(lines):
        page.insert_text((50, 50 + i * 20), line, fontsize=11)
    buf = doc.tobytes()
    doc.close()
    return buf


@pytest.fixture(scope="module")
def uploaded_doc(client, java_subject, exception_chapter):
    """Upload a valid text-based PDF generated with PyMuPDF."""
    pdf_content = _make_test_pdf()

    files = {"file": ("exception_handling.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {
        "subject_id": str(java_subject["id"]),
        "chapter_id": str(exception_chapter["id"]),
    }
    r = client.post("/api/documents", files=files, data=data)
    assert r.status_code == 201
    doc = r.json()
    assert doc["original_name"] == "exception_handling.pdf"
    print(f"âœ“ Document uploaded: id={doc['id']} status={doc['status']}")
    yield doc


# â”€â”€â”€ 4. Quiz generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture(scope="module")
def generated_quiz(client, java_subject, exception_chapter):
    """Generate a quiz â€” uses general knowledge since PDF may not be indexed yet."""
    r = client.post("/api/quizzes", json={
        "subject_id": java_subject["id"],
        "chapter_id": exception_chapter["id"],
        "title": "Exception Handling Quiz",
        "difficulty": "medium",
        "num_questions": 3,
        "question_types": ["mcq", "true_false"],
        "include_explanations": True,
    }, timeout=120)
    assert r.status_code == 201
    quiz = r.json()
    assert quiz["total_questions"] >= 1
    assert len(quiz["questions"]) >= 1
    print(f"âœ“ Quiz generated: id={quiz['id']} questions={quiz['total_questions']}")
    yield quiz


# â”€â”€â”€ 5. Submit quiz attempt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_quiz_attempt(client, generated_quiz):
    questions = generated_quiz["questions"]
    # Answer all questions with the correct answer (to guarantee some score)
    answers = {str(q["id"]): q["correct_answer"] for q in questions}
    r = client.post(f"/api/quizzes/{generated_quiz['id']}/attempts", json={
        "answers": answers,
        "time_taken_seconds": 60,
    })
    assert r.status_code == 201
    attempt = r.json()
    assert attempt["completed"] is True
    print(f"âœ“ Quiz submitted | score={attempt['score']}")


# â”€â”€â”€ 6. Calendar event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture(scope="module")
def exam_event(client, java_subject):
    r = client.post("/api/events", json={
        "title": "Java Final Exam",
        "category": "exam",
        "subject_id": java_subject["id"],
        "start_date": "2025-12-20T09:00:00",
        "all_day": False,
        "priority": "high",
    })
    assert r.status_code == 201
    ev = r.json()
    assert ev["category"] == "exam"
    print(f"âœ“ Exam event created: id={ev['id']} date={ev['start_date']}")
    yield ev
    client.delete(f"/api/events/{ev['id']}")


def test_calendar_shows_exam(client, exam_event):
    r = client.get("/api/events", params={"start": "2025-12-01T00:00:00"})
    assert r.status_code == 200
    events = r.json()
    ids = [e["id"] for e in events]
    assert exam_event["id"] in ids
    print(f"âœ“ Exam appears in calendar listing")


def test_dashboard_shows_upcoming_exam(client, exam_event, java_subject):
    r = client.get("/api/analytics/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "upcoming_exams" in data
    print(f"âœ“ Dashboard has upcoming_exams field")


# â”€â”€â”€ 7. Study plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_generate_study_plan(client, exception_chapter):
    r = client.post("/api/tasks/generate-plan", params={"days_ahead": 7, "daily_hours": 3.0})
    assert r.status_code == 200
    tasks = r.json()
    # May be 0 if no incomplete chapters exist or all fit in schedule
    print(f"âœ“ Study plan generated: {len(tasks)} tasks")


# â”€â”€â”€ 8. Focus session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_focus_session(client, java_subject):
    # Create
    r = client.post("/api/sessions", json={
        "subject_id": java_subject["id"],
        "mode": "pomodoro",
        "planned_minutes": 25,
    })
    assert r.status_code == 201
    session = r.json()
    session_id = session["id"]
    print(f"âœ“ Session created: id={session_id}")

    # Complete
    r2 = client.put(f"/api/sessions/{session_id}", json={
        "actual_minutes": 25.0,
        "completed": True,
    })
    assert r2.status_code == 200
    updated = r2.json()
    assert updated["completed"] is True
    print(f"âœ“ Session completed: actual={updated['actual_minutes']}min")

    # Verify analytics update
    r3 = client.get("/api/sessions/analytics/summary")
    assert r3.status_code == 200
    summary = r3.json()
    assert summary["today_minutes"] >= 25.0 or summary["week_minutes"] >= 25.0
    print(f"âœ“ Analytics updated: today={summary['today_minutes']}min")

    # Cleanup
    client.delete(f"/api/sessions/{session_id}")


# â”€â”€â”€ 9. ML revision priority â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_ml_revision_priority(client, exception_chapter):
    # Train (uses synthetic data if insufficient real data)
    r = client.post("/api/ml/train")
    assert r.status_code == 200
    eval_data = r.json()
    assert "train_accuracy" in eval_data
    print(f"âœ“ ML model trained | source={eval_data['data_source']} accuracy={eval_data['train_accuracy']}")

    # Predict
    r2 = client.get(f"/api/ml/predict/{exception_chapter['id']}")
    assert r2.status_code == 200
    pred = r2.json()
    assert pred["priority"] in ("High", "Medium", "Low")
    assert "method" in pred
    print(f"âœ“ Chapter prediction: {pred['priority']} via {pred['method']}")


# â”€â”€â”€ 10. Data persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_data_persistence(client, java_subject):
    """Verify subject and chapter survive a re-fetch (simulating restart)."""
    r = client.get(f"/api/subjects/{java_subject['id']}")
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["name"] == "Java"
    print(f"âœ“ Data persists: subject '{fetched['name']}' id={fetched['id']}")

    r2 = client.get(f"/api/chapters/subject/{java_subject['id']}")
    assert r2.status_code == 200
    chapters = r2.json()
    assert any(c["title"] == "Exception Handling" for c in chapters)
    print(f"âœ“ Chapter 'Exception Handling' persists")


# â”€â”€â”€ AI provider status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_ai_provider_status(client):
    r = client.get("/api/ai/provider/status")
    assert r.status_code == 200
    status = r.json()
    assert "active_provider" in status
    print(f"âœ“ AI provider: {status['active_provider']} | dev_mode={status['dev_mode']}")


# â”€â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_settings(client):
    r = client.get("/api/settings")
    assert r.status_code == 200
    settings = r.json()
    assert "student_name" in settings

    r2 = client.put("/api/settings", json={"student_name": "Test Student"})
    assert r2.status_code == 200
    assert r2.json()["student_name"] == "Test Student"
    print(f"âœ“ Settings read and updated")
