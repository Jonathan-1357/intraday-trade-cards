#!/usr/bin/env bash
set -e

echo "==> Setting up Intraday Trade Card System"

# API
echo ""
echo "-- API setup"
cd "$(dirname "$0")/../apps/api"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env 2>/dev/null || true
echo "   API ready"

# Web
echo ""
echo "-- Web setup"
cd "$(dirname "$0")/../apps/web"
npm install
cp -n .env.local.example .env.local 2>/dev/null || true
echo "   Web ready"

echo ""
echo "==> Setup complete"
echo "    Run: ./scripts/dev.sh"
