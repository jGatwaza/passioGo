#!/bin/zsh
# Script to start both backend (FastAPI) and frontend (Vite) servers

# Start backend
cd "$(dirname "$0")/backend"
echo "Starting backend (FastAPI)..."
source ../.venv/bin/activate
uvicorn main:app --reload &
BACKEND_PID=$!

# Start frontend
cd ../frontend
echo "Starting frontend (Vite)..."
npm run dev &
FRONTEND_PID=$!

# Wait for both to finish (Ctrl+C to stop both)
wait $BACKEND_PID $FRONTEND_PID
