#!/bin/bash
# Learnova AI — Linux/macOS Start Script
# Usage: chmod +x start.sh && ./start.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/learnova-backend"
FRONTEND="$ROOT/learnova-frontend"

echo ""
echo "============================================"
echo "  Learnova AI - Starting..."
echo "============================================"
echo ""

# ---- Backend ----------------------------------------------------------------
cd "$BACKEND"

if [ ! -d "venv" ]; then
    echo "[Backend] Creating virtual environment..."
    python3 -m venv venv
fi

if [ ! -f ".env" ]; then
    echo "[Backend] .env not found — copying from .env.example"
    cp .env.example .env
    echo "[Backend] Edit $BACKEND/.env to add IBM watsonx.ai or OpenAI API keys."
fi

echo "[Backend] Installing Python dependencies..."
./venv/bin/pip install -q -r requirements.txt

echo "[Backend] Starting FastAPI on http://localhost:8000 ..."
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend
for i in $(seq 1 15); do
    sleep 2
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "[Backend] Ready!"
        break
    fi
done

# ---- Frontend ---------------------------------------------------------------
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
    echo "[Frontend] Installing npm dependencies..."
    npm install
fi

echo "[Frontend] Starting Vite dev server on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  Learnova AI is running!"
echo ""
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:8000"
echo "  API Docs : http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "============================================"
echo ""

# Trap Ctrl+C
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Done."
}
trap cleanup INT TERM

wait
