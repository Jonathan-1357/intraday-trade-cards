# Developer Guide
## Intraday Trade Card System

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm

---

## Project Structure

```
intraday-trade-cards/
├── apps/
│   ├── api/                  FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py       App entry point, CORS, startup
│   │   │   ├── config.py     Settings (pydantic-settings, .env)
│   │   │   ├── database.py   SQLAlchemy engine, session, init_db
│   │   │   ├── models/       SQLAlchemy ORM models
│   │   │   ├── schemas/      Pydantic request/response schemas
│   │   │   ├── routes/       FastAPI routers (trade_cards, risk_config, watchlist)
│   │   │   ├── services/     Business logic (signal_evaluator, card_generator, etc.)
│   │   │   └── utils/        mock_data.py (price data simulation)
│   │   ├── requirements.txt
│   │   └── .env.example
│   └── web/                  Next.js 14 frontend
│       ├── app/              App Router pages
│       ├── components/       React components
│       ├── lib/              api.ts, utils.ts, constants.ts
│       ├── types/            TypeScript types
│       └── package.json
├── shared/
│   └── trade-card-schema/
│       └── trade-card.json   Canonical JSON Schema for TradeCard
├── docs/                     This folder
└── scripts/
    ├── setup.sh              First-time dependency install
    └── dev.sh                Start both servers
```

---

## First-Time Setup

```bash
# From repo root
./scripts/setup.sh
```

This script:
1. Creates a Python venv at `apps/api/.venv`
2. Installs Python dependencies from `requirements.txt`
3. Copies `apps/api/.env.example` → `apps/api/.env`
4. Runs `npm install` in `apps/web`
5. Copies `apps/web/.env.local.example` → `apps/web/.env.local`

---

## Running Locally

```bash
./scripts/dev.sh
```

- **API:** http://localhost:8000
- **Web:** http://localhost:3000
- **Swagger docs:** http://localhost:8000/docs

Or run each manually:

```bash
# API (with hot reload)
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Web (in a separate terminal)
cd apps/web
npm run dev
```

---

## Environment Variables

### API — `apps/api/.env`

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./trade_cards.db` | SQLite path |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed frontend origins |
| `DEFAULT_CAPITAL` | `100000.0` | Seeded capital on first run |
| `DEFAULT_RISK_PER_TRADE` | `1000.0` | Seeded risk per trade on first run |

### Web — `apps/web/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | API base URL |

---

## Database

SQLite file: `apps/api/trade_cards.db`

Tables are created automatically on startup (`init_db()` in `database.py`).
Default rows are seeded if tables are empty:
- RiskConfig: capital=₹100,000 / risk=₹1,000 / max trades=5
- Watchlist: ICICIBANK, RELIANCE, INFY, HDFCBANK, TCS

**To reset the database:**
```bash
rm apps/api/trade_cards.db
# Restart the API — tables and defaults are recreated automatically
```

**Important:** If you add a new column to a model, delete the DB and restart.
`create_all()` does not run migrations — it only creates missing tables.

---

## Architecture

```
Browser
  │
  ├── GET /  (Next.js Server Component)
  │     └── fetch /api/v1/trade-cards  ──→  FastAPI
  │                                           └── SQLite
  │
  └── "Generate Cards" button click
        └── POST /api/v1/trade-cards/generate
              └── for each symbol in watchlist:
                    get_mock_quote(symbol)
                    → evaluate_signal(quote)     [signal_evaluator.py]
                    → calculate_quantity(...)    [risk_calculator.py]
                    → persist TradeCardModel     [SQLite]
```

### Key Services

| File | Responsibility |
|---|---|
| `services/signal_evaluator.py` | 3-tier rule engine — determines buy/sell, confidence, SL, target |
| `services/risk_calculator.py` | Pure math — quantity, R:R, capital, ATR-based SL |
| `services/card_generator.py` | Orchestrates quote → signal → persist for each symbol |
| `services/card_validator.py` | Lifecycle transitions — refreshes card status against current price |
| `utils/mock_data.py` | Deterministic mock quotes seeded by symbol hash |

---

## Frontend Architecture

- **Server Components** (`app/page.tsx`) — fetch cards, risk config, watchlist on render. No client state.
- **Client Components** — `GenerateButton`, `SelectableCardGrid`, `RiskConfigPanel`, `WatchlistEditor`, `FilterBar`, `CardDetailModal`. Each handles its own interaction and calls `router.refresh()` after mutations to re-run the server fetch.
- **`lib/api.ts`** — typed fetch wrapper. Works in both server and client context.

---

## Connecting Real Market Data

All price data currently comes from `apps/api/app/utils/mock_data.py`.

To plug in a real data source:
1. Create `apps/api/app/utils/market_data.py`
2. Implement `get_live_quote(symbol: str) -> dict` returning the same field names as `get_mock_quote`
3. In `card_generator.py`, replace:
   ```python
   from app.utils.mock_data import get_mock_quote
   quote = get_mock_quote(symbol)
   ```
   with:
   ```python
   from app.utils.market_data import get_live_quote
   quote = get_live_quote(symbol)
   ```

The signal evaluator, risk calculator, and all routes require no changes.

See `docs/signal-rules.md` for the full list of fields the evaluator expects.

---

## Adding a New Signal Rule

1. Open `apps/api/app/services/signal_evaluator.py`
2. Write a function: `def my_rule(q: dict) -> tuple[bool, str]`
3. Add it to `_BUY_CONF_RULES`, `_SELL_CONF_RULES`, `_BUY_BONUS_RULES`, `_SELL_BONUS_RULES`, or `_HARD_GATES`
4. If the rule needs a new data field, add it to `mock_data.py` (append after existing RNG calls — never insert mid-sequence)

---

## Docs Index

| Document | Covers |
|---|---|
| `srs-v1.md` + `srs-v1-1-patch.md` | Product requirements, scope, acceptance criteria |
| `api-contracts.md` | All REST endpoints, request/response shapes |
| `signal-rules.md` | Complete 3-tier signal rules, confidence scoring, SL/target formulas |
| `data-models.md` | DB tables, all fields, mock quote field reference |
| `dev-guide.md` | This file — setup, architecture, how to extend |
