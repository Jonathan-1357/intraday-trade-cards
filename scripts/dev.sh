#!/usr/bin/env bash
set -e

ROOT="$(dirname "$0")/.."

echo "==> Starting API..."
(cd "$ROOT/apps/api" && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000) &
API_PID=$!

echo "==> Starting Web..."
(cd "$ROOT/apps/web" && npm run dev) &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null" EXIT INT TERM

echo ""
echo "API  → http://localhost:8000"
echo "Web  → http://localhost:3000"
echo ""
wait
