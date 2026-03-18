# CLAUDE.md

## Project
This repo is for IRIS EDGE — an intraday market intelligence and trade card system.

## Product intent
Build a desktop-first web app that generates trade cards with:
- symbol
- action
- entry
- stop loss
- target
- quantity
- confidence
- validation status
- reason summary

## Architecture
- Frontend: Next.js in apps/web
- Backend: FastAPI in apps/api
- Docs: docs/

## Rules
- MVP is rule-based, not AI-driven
- Do not add broker execution
- Do not add ML or predictive models unless explicitly requested
- Keep code modular and readable
- Prefer small focused files
- Build KISS-first
