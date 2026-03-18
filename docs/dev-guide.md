# Developer Guide
## IRIS EDGE — Intraday Trade Card System

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS v3 |
| Backend | FastAPI (Python 3.11+), SQLAlchemy, Pydantic v2 |
| Database | SQLite (file: `apps/api/trade_cards.db`) |
| Charts | lightweight-charts v5 |
| Market data | Upstox v2 API (mock fallback when no token) |

---

## Repo Structure

```
intraday-trade-cards/
├── apps/
│   ├── api/                        # FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py             # App entry point, router registration
│   │   │   ├── config.py           # Settings (pydantic-settings)
│   │   │   ├── database.py         # SQLAlchemy engine, session, init_db
│   │   │   ├── models/__init__.py  # All ORM models
│   │   │   ├── schemas/__init__.py # Pydantic I/O schemas
│   │   │   ├── routes/             # One file per feature domain
│   │   │   │   ├── trade_cards.py
│   │   │   │   ├── risk_config.py
│   │   │   │   ├── watchlist.py
│   │   │   │   ├── market.py
│   │   │   │   ├── auto_watchlist.py
│   │   │   │   ├── system.py
│   │   │   │   ├── broker.py
│   │   │   │   └── paper.py
│   │   │   ├── services/           # Business logic
│   │   │   │   ├── signal_evaluator.py
│   │   │   │   ├── risk_calculator.py
│   │   │   │   ├── card_generator.py
│   │   │   │   ├── card_validator.py
│   │   │   │   └── watchlist_scorer.py
│   │   │   └── utils/
│   │   │       ├── mock_data.py        # Deterministic mock quotes
│   │   │       ├── upstox_client.py    # Upstox v2 API wrapper
│   │   │       ├── market_data.py      # Live quote + indicator computation
│   │   │       └── market_hours.py     # IST market hours helpers
│   │   └── requirements.txt
│   └── web/                        # Next.js frontend
│       ├── app/
│       │   ├── layout.tsx          # Root HTML shell
│       │   └── (dashboard)/
│       │       ├── layout.tsx      # Dashboard layout (wraps NavShell)
│       │       ├── page.tsx        # IRIS IQ — trade card dashboard
│       │       ├── watchlist/page.tsx
│       │       ├── config/page.tsx
│       │       └── positions/page.tsx
│       ├── components/             # All UI components
│       ├── context/
│       │   └── PaperModeContext.tsx
│       ├── lib/
│       │   ├── api.ts              # Typed fetch client
│       │   ├── constants.ts        # Color/label maps
│       │   └── utils.ts            # Formatters
│       └── types/index.ts          # Shared TypeScript types
└── docs/                           # This folder
```

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- `pip`, `npm` or `pnpm`

### Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API starts at `http://localhost:8000`.
SQLite database is created automatically at `apps/api/trade_cards.db` on first run.
Swagger docs: `http://localhost:8000/docs`

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

The web app starts at `http://localhost:3000`.

---

## Environment Variables

### Backend (`apps/api/.env`)

```env
DATABASE_URL=sqlite:///./trade_cards.db
CORS_ORIGINS=["http://localhost:3000"]
DEFAULT_CAPITAL=100000.0
DEFAULT_RISK_PER_TRADE=1000.0
UPSTOX_ACCESS_TOKEN=          # Leave empty — set at runtime via the UI
```

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

If `NEXT_PUBLIC_API_URL` is not set, the frontend defaults to `http://localhost:8000/api/v1`.

---

## Connecting to Upstox

1. Log in to your Upstox developer account.
2. Go to **My Apps → API key**.
3. Complete the OAuth login flow and copy the access token (JWT starting with `eyJ`).
4. In the IRIS EDGE UI, click the connection indicator at the bottom of the left nav.
5. Paste the token and click **Connect**.

The token is saved to the database and applied immediately in-memory — no server restart required.

The app works fully without a token using deterministic mock data.

---

## Key Implementation Details

### Mock Data
`utils/mock_data.py` generates quotes seeded by `hash(symbol) % (10**9 + 7)`. This ensures the same symbol always returns the same price/indicators within a single process run, making mock trades predictable and testable.

### Live Data Pipeline
When a token is configured:
1. `utils/upstox_client.py` downloads the NSE instruments list (gzip, ~6 MB) on first call and caches it in-process.
2. `utils/market_data.py` fetches 60-day daily candles and computes RSI, EMA9/21/50, MACD, ATR, Bollinger Bands, StochRSI, OBV via the `ta` library.
3. The computed dict matches the mock data shape exactly — all downstream code is agnostic to data source.

### Chart Timestamps
Upstox returns ISO 8601 timestamps. The market route converts these to Unix seconds and adds `19800` (5h30m IST offset) so lightweight-charts (which treats timestamps as UTC) displays correct Indian market hours.

`60minute` and `120minute` intervals are built by aggregating `30minute` data client-side (Upstox only natively supports `1minute`, `30minute`, `day`).

### Paper Trading
Paper orders fill immediately at market LTP (or limit price for LIMIT orders). There is no order book simulation — all paper orders are assumed to fill at the requested price. The wallet balance, positions, and orders are persisted in SQLite so they survive server restarts.

### Token Persistence
`ApiConfigModel` stores the token in the DB. `load_token_from_db()` is called at startup and populates `settings.upstox_access_token` in-memory. `PUT /system/connection` updates both the DB and the live in-memory setting atomically.

### Card Deduplication
Before generating, `card_generator.py` queries all non-archived, non-terminal cards and collects their symbols into a set. Any symbol already in that set is skipped, preventing duplicate active cards for the same symbol.

---

## Adding a New Signal Rule

1. Open `apps/api/app/services/signal_evaluator.py`.
2. Add a new function returning `tuple[bool, str]` — `(passed, reason_string)`.
3. Add it to the `BUY_RULES` or `SELL_RULES` list (Tier 2) or `BUY_BONUS` / `SELL_BONUS` (Tier 3).
4. Add any required indicator to `utils/mock_data.py` (mock) and `utils/market_data.py` (live).

No schema changes needed — `reasons` is a JSON array.

---

## Adding a New Page

1. Create `apps/web/app/(dashboard)/your-page/page.tsx`.
2. Add a nav item to `components/NavShell.tsx` in `NAV_ITEMS`.
3. If the page needs paper mode awareness, use `usePaperMode()` from `context/PaperModeContext.tsx`.

---

## Database Reset

```bash
rm apps/api/trade_cards.db
# Restart the API — tables and seed data recreated automatically
```

---

## API Python Dependencies

Key packages:
- `fastapi` + `uvicorn` — web server
- `sqlalchemy` — ORM
- `pydantic` + `pydantic-settings` — validation and config
- `httpx` — sync HTTP client for Upstox calls
- `ta` — technical analysis indicators (RSI, EMA, MACD, ATR, etc.)

---

## Frontend Key Libraries

| Library | Purpose |
|---|---|
| `next` 14 | App Router, Server Components, streaming |
| `react` 18 | UI, hooks, context |
| `tailwindcss` | Utility-first styling |
| `lightweight-charts` v5 | Candlestick charting |

Styling convention: all colours are from the `gray-*`, `green-*`, `red-*`, `indigo-*`, `blue-*`, `amber-*` Tailwind palettes on a `gray-950` background.
