# Architecture
## IRIS EDGE — Intraday Trade Card System

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (Next.js 14)                │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌───────┐  │
│  │  IRIS IQ │  │Watchlist │  │ Positions  │  │Config │  │
│  │Dashboard │  │  /Auto   │  │ (P&L/Orders│  │(Risk) │  │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  └───┬───┘  │
│       │              │              │              │      │
│  ┌────▼──────────────▼──────────────▼──────────────▼───┐  │
│  │                   NavShell                          │  │
│  │  (PaperModeProvider · ConnectionIndicator · Toggle) │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────┘
                          │ fetch (REST JSON)
                          ▼
┌──────────────────────────────────────────────────────────┐
│                   FastAPI (port 8000)                    │
│                                                          │
│  Routes:                                                 │
│  /trade-cards   /risk-config   /watchlist   /market      │
│  /auto-watchlist   /system   /broker   /broker/paper     │
│                                                          │
│  Services:                                               │
│  SignalEvaluator → RiskCalculator → CardGenerator        │
│  CardValidator   WatchlistScorer                         │
│                                                          │
│  Utils:                                                  │
│  MockData  ←──── UpstoxClient ←──── MarketData           │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
               ▼                           ▼
        SQLite DB                   Upstox v2 API
    (trade_cards.db)             (when token set)
```

---

## Data Flow: Card Generation

```
User clicks "AI Trade Insights"
        │
        ▼
POST /trade-cards/generate
        │
        ├── Fetch watchlist symbols from DB
        ├── Query existing live cards → build exclusion set
        │
        └── For each symbol (not excluded):
              │
              ├── get_live_quote(symbol)  ←── Upstox API
              │   OR get_mock_quote(symbol)   (no token)
              │
              ├── signal_evaluator.evaluate(quote)
              │     Tier 1: Hard gates (all must pass)
              │     Tier 2: Confirmation rules (need ≥2)
              │     Tier 3: Bonus rules (+0.5 each)
              │     → confidence, score, reasons[]
              │
              ├── risk_calculator.calculate_*()
              │     stop_loss = entry ± 1×ATR
              │     target    = entry ± 2×risk
              │     quantity  = floor(risk_₹ / per_share_risk)
              │     rr        = reward / risk
              │
              ├── Filter: confidence ≠ "none" AND rr ≥ 1.5
              │
              └── Save TradeCardModel to DB
        │
        ▼
Return { generated, cards[], skipped_symbols[] }
        │
        ▼
Frontend router.refresh() → cards appear in grid
```

---

## Data Flow: Paper Order

```
User clicks Execute on a trade card
        │
        ▼
ExecuteModal opens
  └── reads usePaperMode() → isPaper = true
  └── shows paper wallet balance as "available margin"
        │
        ▼
User clicks "Place BUY Order"
        │
        ▼
POST /broker/paper/order  { symbol, action, order_type, price, qty }
        │
        ├── Get fill price:
        │     if Upstox token → get_market_quote(symbol) → LTP
        │     else            → get_mock_quote(symbol) → price
        │
        ├── action = "buy":
        │     Check balance ≥ cost → deduct balance
        │     Upsert PaperPositionModel (avg price, qty)
        │
        ├── action = "sell":
        │     Credit balance
        │     Reduce / delete PaperPositionModel
        │
        ├── Insert PaperOrderModel
        ├── Commit to SQLite
        │
        └── Return { order_id, executed_price, balance_after, paper: true }
        │
        ▼
ExecuteModal shows success → usePaperMode().refresh()
        │
        ▼
Nav balance badge updates with new balance
```

---

## Data Flow: Auto-Watchlist Scan

```
User clicks "Auto-Scan Market"
        │
        ▼
POST /auto-watchlist/generate
        │
        ├── Delete today's existing DailyWatchlistModel rows
        │
        └── For each symbol in universe (~100 stocks):
              │
              ├── get_mock_quote(symbol) [or live if token]
              │
              ├── Score 14 factors:
              │     gap%, volume spike, RSI, EMA stack,
              │     MACD, sector, ATR, OR breakout, Nifty,
              │     liquidity penalty, circuit penalty
              │
              └── Tag with category based on dominant factors
        │
        ├── Sort by score descending, take top 30
        ├── Assign rank 1–30
        ├── Persist to DailyWatchlistModel
        │
        └── Return { generated: 30, date }
        │
        ▼
GET /auto-watchlist/today → frontend groups by category
```

---

## State Management (Frontend)

```
PaperModeContext (React Context)
  └── Provided at NavShell level (wraps entire dashboard)
  └── Consumed by:
        ├── NavShell (toggle switch, balance badge)
        ├── PaperWalletModal (wallet management)
        ├── ExecuteModal (switches order endpoint)
        ├── PositionsView (switches data source)
        └── RiskConfigFull (switches capital field behaviour)
```

No global state library — context is sufficient for this feature's scope. All other data is fetched server-side (Server Components) or locally within each component.

---

## URL Structure

| URL | Page | Data fetched server-side |
|---|---|---|
| `/` | IRIS IQ Dashboard | Trade cards, risk config |
| `/watchlist` | Watchlist | Watchlist symbols, active cards |
| `/positions` | Open Positions | (client-side fetch only) |
| `/config` | Risk Config | Risk config |

All pages live under the `(dashboard)` route group which wraps them in `NavShell`.

---

## Security Model

This is a **single-user local application**. There is no authentication layer — the assumption is the app runs on the user's own machine and is not exposed to the internet.

The Upstox access token is stored in plaintext in SQLite. Do not expose the API port (`8000`) to external networks.

---

## Mock vs Live Data

Every data-consuming service checks for the token before deciding which path to take:

```python
if settings.upstox_access_token:
    quote = get_live_quote(symbol, settings.upstox_access_token)
else:
    quote = get_mock_quote(symbol)   # deterministic, hash-seeded
```

This pattern applies in:
- `card_generator.py` (quote for signal evaluation)
- `watchlist_scorer.py` (quote for scoring)
- `routes/paper.py` (LTP for paper order fill price)
- `routes/broker.py` (all broker operations degrade to mock)
- `routes/market.py` (candle data and live quotes)
