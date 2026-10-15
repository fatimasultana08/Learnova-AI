# Learnova AI

An intelligent, all-in-one personal study and exam management platform. Upload your own textbook PDFs, ask questions grounded in your own material with source citations, generate quizzes, plan your study schedule, track focus sessions, and get AI-powered revision priorities.

---

## Project Structure

```
learnova-ai/
├── learnova-backend/        # Python / FastAPI backend
│   ├── app/
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── database.py      # DB engine + session factory
│   │   ├── rag.py           # PDF ingestion, chunking, ChromaDB vector store
│   │   ├── ai_provider.py   # IBM watsonx.ai / OpenAI / dev fallback layer
│   │   ├── ml_priority.py   # scikit-learn revision-priority classifier
│   │   └── routers/         # One file per feature area
│   │       ├── subjects.py
│   │       ├── chapters.py
│   │       ├── documents.py
│   │       ├── ai_assistant.py
│   │       ├── quizzes.py
│   │       ├── calendar.py
│   │       ├── tasks.py
│   │       ├── sessions.py
│   │       └── misc.py      # analytics, notifications, settings, courses, ML
│   ├── tests/
│   │   └── test_integration.py
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   └── pytest.ini
│
├── learnova-frontend/       # React / TypeScript / Vite / Tailwind
│   ├── src/
│   │   ├── api/index.ts     # Typed API client (axios)
│   │   ├── context/         # ThemeContext (light/dark)
│   │   ├── components/      # Sidebar, Topbar
│   │   └── pages/           # 14 pages
│   │       ├── Dashboard.tsx
│   │       ├── Subjects.tsx / SubjectDetail.tsx
│   │       ├── AIAssistant.tsx
│   │       ├── Notes.tsx
│   │       ├── Quizzes.tsx / QuizTake.tsx
│   │       ├── Courses.tsx
│   │       ├── CalendarPage.tsx
│   │       ├── Planner.tsx
│   │       ├── FocusTimer.tsx
│   │       ├── Analytics.tsx
│   │       ├── NotificationsPage.tsx
│   │       └── SettingsPage.tsx
│   └── vite.config.ts       # Proxies /api → localhost:8000
│
├── start.ps1                # Windows one-command launcher
├── start.sh                 # Linux/macOS one-command launcher
└── README.md
```

---

## Quick Start

### Windows (PowerShell)

```powershell
# From the project root
.\start.ps1
```

### Linux / macOS

```bash
chmod +x start.sh && ./start.sh
```

Both scripts will:
1. Create a Python virtual environment
2. Install Python dependencies
3. Copy `.env.example` → `.env` if missing
4. Start the FastAPI backend on **http://localhost:8000**
5. Start the Vite dev server on **http://localhost:5173**

Then open **http://localhost:5173** in your browser.

---

## Manual Setup

### Backend

```bash
cd learnova-backend

# Create venv and install dependencies
python -m venv venv
# Windows:
.\venv\Scripts\pip install -r requirements.txt
# Linux/macOS:
./venv/bin/pip install -r requirements.txt

# Copy and edit environment variables
cp .env.example .env
# (edit .env — see AI Configuration below)

# Start server
# Windows:
.\venv\Scripts\uvicorn main:app --reload --port 8000
# Linux/macOS:
./venv/bin/uvicorn main:app --reload --port 8000
```

The database (`learnova.db`) and vector store (`chroma_db/`) are created automatically on first run.

### Frontend

```bash
cd learnova-frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `learnova-backend/.env.example` to `learnova-backend/.env` and fill in the values:

```env
# === IBM watsonx.ai (primary AI provider) ===
# Get credentials at https://cloud.ibm.com → watsonx.ai
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-instruct-v2

# === OpenAI (fallback — used only if watsonx not configured) ===
OPENAI_API_KEY=your_openai_api_key

# === Database ===
DATABASE_URL=sqlite:///./learnova.db

# === File storage ===
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50

# === Vector store ===
CHROMA_DIR=./chroma_db
```

**API keys are stored only in `.env` on the backend. They are never sent to the frontend.**

---

## IBM watsonx.ai Configuration

Learnova AI integrates with IBM watsonx.ai as its primary AI provider.

### Steps to configure

1. Log in to **https://cloud.ibm.com** with your IBM Masterclass account.
2. Navigate to **watsonx.ai** → create a project or use an existing one.
3. Copy your **Project ID** from the project settings.
4. Generate an **API key** at: **Manage → Access (IAM) → API keys**.
5. Confirm the region URL (default: `https://us-south.ml.cloud.ibm.com`).
6. Paste these into `learnova-backend/.env`.

### Supported models

The default model is `ibm/granite-13b-instruct-v2`. Other available models in watsonx.ai include:
- `ibm/granite-13b-chat-v2`
- `meta-llama/llama-3-8b-instruct`
- `mistralai/mistral-large`

Change `WATSONX_MODEL_ID` in `.env` to switch models.

### Without credentials (Dev Mode)

Without credentials, all AI features run in **clearly-labelled dev mode**. Responses are placeholders — they are visually marked `⚠️ Dev Mode` so they are never confused with real AI output. All other features (subjects, chapters, quizzes, calendar, timer, analytics, ML) work fully without any API keys.

---

## Features

| Feature | Description |
|---|---|
| **Subjects & Chapters** | Create, edit, archive subjects with colour-coded progress |
| **PDF Upload & RAG** | Upload PDFs → auto-chunked, embedded, searchable |
| **AI Study Assistant** | Q&A grounded in your documents with page citations |
| **Quiz Generator** | MCQ, True/False, Fill-blank, Short-answer; auto-scored |
| **Academic Calendar** | Month view with exams, assignments, reminders |
| **Study Planner** | Auto-generate tasks from exam dates + chapter backlog |
| **Focus Timer** | Pomodoro + stopwatch; persisted session history |
| **Analytics** | Daily/weekly study time, subject distribution, quiz scores |
| **ML Revision Priority** | scikit-learn classifier: High / Medium / Low per chapter |
| **Notifications** | Auto-warnings for overdue tasks + upcoming exams |
| **Courses** | Manage external courses with modules and lessons |
| **Dark / Light Mode** | Full theme support |

---

## Running Tests

```bash
cd learnova-backend

# Backend must be running on port 8000 first
# Windows:
.\venv\Scripts\pytest tests/ -v
# Linux/macOS:
./venv/bin/pytest tests/ -v
```

The integration test suite covers the full workflow:
- Subject + chapter creation
- PDF upload
- Quiz generation + submission
- Calendar event creation
- Study plan generation
- Focus session recording + analytics update
- ML revision priority prediction
- Data persistence check
- AI provider status
- Settings read/write

All 10 tests pass (run time: ~3 seconds against a live server).

---

## API Documentation

Interactive Swagger UI: **http://localhost:8000/docs**

ReDoc: **http://localhost:8000/redoc**

---

## PDF Support & Limitations

- **Supported:** Text-based PDFs (standard lecture notes, textbooks, slides exported to PDF)
- **Not supported:** Scanned image-only PDFs — OCR is not installed. The app clearly reports this error if a scanned PDF is uploaded.
- **Maximum file size:** 50 MB (configurable via `MAX_FILE_SIZE_MB`)
- **Processing:** Asynchronous background task. Status updates from `pending` → `processing` → `ready`

### First PDF upload

The sentence-transformers embedding model (`all-MiniLM-L6-v2`, ~90 MB) is downloaded from Hugging Face on first use. This is a one-time operation and the model is cached locally. After the first download, all embedding runs offline.

---

## AI Safety Notes

- Uploaded PDFs are treated as **untrusted content**. Prompt injection from document text cannot affect backend behaviour.
- When document evidence is insufficient, the system explicitly says so and asks whether you want a general-knowledge answer.
- Dev-mode placeholder responses are **always visually labelled** — they can never be confused with real AI output.
- Citations (document name, page number, excerpt) are only shown when the RAG pipeline returns a result with similarity ≥ 0.25. Lower-confidence chunks are suppressed.

---

## ML Revision Priority

The scikit-learn `RandomForestClassifier` classifies each chapter as **High / Medium / Low** revision priority.

**Features used:**
- Recent quiz accuracy (0–1)
- Number of quiz attempts
- Incorrect-answer ratio
- Days since last revision
- Self-reported confidence (0–100)
- Completion status (not started / in progress / completed / needs revision)

**Training data:** Automatically collects from your real chapter + quiz history. When fewer than 10 labelled records exist, trains on a clearly-identified synthetic sample and labels predictions accordingly.

**Evaluation:** When ≥ 20 real records exist, a 80/20 train/test split is used and precision, recall, F1, and confusion matrix are reported. The `/api/ml/train` response always includes `data_source` and `metrics_note` so you know exactly what was used.

**Important:** Predictions are study guidance, not guarantees. Always use your own judgment.

---

## Known Limitations

1. **No user authentication** — Learnova AI is a single-user local application. Do not deploy it on a public server without adding authentication.
2. **OCR not included** — Scanned PDFs are rejected with a clear error message.
3. **Background reminders** — In-app notifications work while the browser is open. There is no background push-notification mechanism; browser notifications are not yet implemented.
4. **AI in dev mode** — Without real API credentials, AI responses are clearly labelled placeholders.
5. **Quiz short-answer grading** — Objective questions (MCQ, True/False, Fill-blank) are auto-scored exactly. Short-answer questions require AI to evaluate; without credentials this is not scored.
6. **Single timezone** — Dates are stored as UTC; the frontend displays them in the browser's local timezone.
7. **Vector store** — ChromaDB persists locally in `chroma_db/`. Deleting this folder removes all document indexes (the original PDFs remain in `uploads/`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| Charts | Recharts |
| Backend | Python 3.14 · FastAPI · Uvicorn |
| Database | SQLite via SQLAlchemy 2 |
| Vector store | ChromaDB (persistent) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (local, offline after first run) |
| PDF parsing | PyMuPDF (fitz) |
| ML | scikit-learn RandomForestClassifier |
| Primary AI | IBM watsonx.ai (Granite / Llama / Mistral) |
| Fallback AI | OpenAI GPT-3.5-turbo |
