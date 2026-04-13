# IRIS EDGE — System Overview

> Tech stack, signal intelligence, and end-to-end workflow

---

## 1. Tech Stack

### Frontend — `apps/web`

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Server + client components, routing |
| Language | **TypeScript** | Type-safe React components and API calls |
| Styling | **Tailwind CSS** | Utility-first dark-mode UI |
| Charts | **lightweight-charts v5** | Candlestick charts in position view |
| State | **React Context** (`PaperModeContext`) | Paper mode toggle shared across components |
| Rendering | Server Components + `"use client"` | Data fetched at render time on server; interactivity on client |

Key components:
- `TradeCard` — displays a generated signal card with live LTP polling
- `ExecuteModal` — order placement (live or paper), bracket order support
- `PositionsView` — open positions with live P&L, chart, close
- `PositionChartModal` — 1-min candlestick chart with entry/SL/target overlays
- `RiskConfigFull` — risk settings, reads live Upstox balance
- `NavShell` / `PaperWalletModal` — paper mode wallet management

---

### Backend — `apps/api`

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **FastAPI** | Async REST API, auto-docs at `/docs` |
| Language | **Python 3.11+** | Signal engine, broker integration |
| ORM | **SQLAlchemy** (sync) | Database models and queries |
| Database | **SQLite** (`trade_cards.db`) | Persists cards, risk config, paper wallet |
| Market data | **Upstox v2 API** | Live quotes, candles, order placement |
| Indicators | **`ta` library** (Technical Analysis) | RSI, EMA, MACD, ATR, Bollinger, StochRSI, OBV |
| Data wrangling | **pandas + numpy** | Candle series processing |
| HTTP client | **httpx** | Synchronous calls to Upstox REST API |

---

### Infrastructure

```
apps/
├── web/          Next.js 14 — port 3000
└── api/          FastAPI    — port 8000
    └── trade_cards.db   SQLite (auto-created on startup)
```

Both servers run independently. The frontend calls the API via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

---

## 2. Data Sources

All market data comes from **Upstox v2 REST API**. No mock data is used anywhere in the system — every call requires a valid Upstox access token.

| Data type | Upstox endpoint | Used for |
|---|---|---|
| Live quote | `GET /market-quote/quotes` | Current price, OHLC, volume, VWAP |
| Daily candles | `GET /historical-candle/{key}/day/...` | Indicator calculation (RSI, EMA, ATR, etc.) |
| Intraday 15-min | `GET /historical-candle/intraday/{key}/15minute` | Opening range detection |
| Intraday 1-min | `GET /historical-candle/{key}/1minute/...` | Position chart |
| Index quote | `GET /market-quote/quotes` (Nifty 50 key) | Nifty direction context |
| Instruments list | `assets.upstox.com/.../NSE.json.gz` | Symbol → instrument key resolution (cached) |
| Funds | `GET /user/get-funds-and-margin` | Available equity margin |
| Order placement | `POST /order/place` | Live order execution |
| Positions | `GET /portfolio/short-term-positions` | Open positions |
| Orders history | `GET /order/retrieve-all` | Today's orders |

---

## 3. Indicator Computation

Every time a quote is requested (`get_live_quote`), the following pipeline runs:

```
Live quote (Upstox)
    ↓
Last 60 daily candles (Upstox)
    ↓
pandas DataFrame
    ↓
ta library computes:
  RSI(14)       StochRSI(14,3,3)    EMA(9,21,50)
  MACD(12,26,9) ATR(14)             BollingerBands(20,2)
  OBV
    ↓
First 15-min intraday candle → Opening Range (OR high/low)
    ↓
Nifty 50 quote → EMA(9) → market direction
    ↓
Full quote dict returned to signal evaluator
```

All indicators are computed fresh on every call — no caching.

---

## 4. Signal Engine

The signal engine (`signal_evaluator.py`) is a **three-tier rule system**. It evaluates a quote dict and returns a `SignalResult` with action, entry, stop loss, target, confidence, and reasons.

### Tier 1 — Hard Gates (must all pass)

Gates are direction-agnostic and block card generation entirely if any fails.

| Gate | Condition | Fail reason |
|---|---|---|
| Time window | `is_market_open()` is True | blocked: outside trading hours |
| Circuit breaker | Price not within 2% of upper/lower circuit limit | blocked: near circuit breaker |
| Volume ratio | Current volume ÷ 20-day avg ≥ 0.5 | blocked: insufficient volume |
| ATR minimum | ATR(14) ≥ ₹5 | blocked: ATR too low (illiquid/flat) |
| SL validity | ATR-based stop loss is positive and ≠ entry | blocked: SL invalid |

**If any gate fails → `confidence = "none"` → no card generated.**

---

### Tier 2 — Confirmation Rules (1 point each)

Both buy and sell directions are scored independently. The higher-scoring direction wins.

#### Buy rules

| Rule | Condition |
|---|---|
| Price above VWAP | `price > vwap` |
| RSI bullish zone | `55 ≤ RSI ≤ 73` |
| Bullish EMA stack | `price > EMA9 > EMA21` |
| MACD positive | MACD histogram > 0 |
| OBV trending up | OBV last 3 values rising |
| Nifty not bearish | Nifty direction ≠ "down" |
| StochRSI not overbought | StochRSI K < 80 |

#### Sell rules

| Rule | Condition |
|---|---|
| Price below VWAP | `price < vwap` |
| RSI bearish zone | `27 ≤ RSI ≤ 45` |
| Bearish EMA stack | `price < EMA9 < EMA21` |
| MACD negative | MACD histogram < 0 |
| OBV trending down | OBV last 3 values falling |
| Nifty not bullish | Nifty direction ≠ "up" |
| StochRSI not oversold | StochRSI K > 20 |

---

### Tier 3 — Bonus Rules (0.5 points each)

| Rule | Buy condition | Sell condition |
|---|---|---|
| Opening range breakout | Price > OR high | Price < OR low |
| Sector alignment | Sector direction = "up" | Sector direction = "down" |
| Bollinger squeeze | BB width < 2% of price | BB width < 2% of price |

---

### Confidence Scoring

```
Total score = sum of Tier 2 (1pt each) + sum of Tier 3 (0.5pt each)

Score ≥ 6.0  →  "strong"
Score ≥ 4.0  →  "valid"
Score ≥ 2.0  →  "weak"
Score < 2.0  →  "none"   (no card generated)
```

---

### Entry, Stop Loss, Target Calculation

```
Entry     = current live price
Stop Loss = entry ± ATR(14)
            buy  → entry - ATR
            sell → entry + ATR

Risk      = |entry - stop_loss|
Target    = entry ± 2 × risk   (2:1 risk/reward)
            buy  → entry + 2 × risk
            sell → entry - 2 × risk
```

A card is only generated if `risk_reward ≥ 1.5`.

---

## 5. Auto-Scan (Watchlist Scorer)

The auto-scan engine (`watchlist_scorer.py`) runs across a universe of ~80 Nifty stocks, scores each, and ranks the top 30 for the day.

### Scoring Weights

| Signal | Points | Direction |
|---|---|---|
| Volume Spike (ratio > 2×) | +20 | Bullish or Bearish |
| Gap Up (> 1.5%) | +15 | Bullish |
| OR Breakout Up | +15 | Bullish |
| High Volume (ratio > 1.5×) | +12 | Both |
| Strong Sector | +10 | Bullish |
| RSI Bullish (55–73) | +10 | Bullish |
| Bullish EMA Stack | +10 | Bullish |
| High ATR (> 1.5% of price) | +10 | Both |
| Gap Down (> 1.5%) | +10 | Bearish |
| RSI Reversal Zone (27–45) | +8 | Bearish |
| Bearish EMA Stack | +8 | Bearish |
| OR Breakdown | +8 | Bearish |
| MACD Positive | +5 | Bullish |
| Nifty Aligned | +5 | Both |
| Weak Sector | -5 | Penalty |
| Near Circuit Limit | -10 | Penalty |
| Low Liquidity (vol < 100K) | -25 | Penalty |

### Category Classification

| Category | Trigger conditions |
|---|---|
| Gap Up Momentum | Gap Up + Volume Spike/High Volume |
| Gap Down Reversal | Gap Down + RSI Reversal/High Volume |
| Breakout Candidate | OR Breakout Up or Bullish EMA + Volume |
| High Volume Mover | Any volume spike without gap/OR |
| Strong Momentum | Default for high-scoring stocks |

### Bias → Action

Bull tags (Gap Up, RSI Bullish, Bullish EMA, OR Breakout ↑, MACD Positive) vs bear tags (Gap Down, RSI Reversal, Bearish EMA, OR Breakdown) are counted. Whichever set has more matching tags = suggested action.

---

## 6. Risk & Position Sizing

```python
# If risk_mode = "percent"
risk_amount = (risk_per_trade / 100) × total_capital

# If risk_mode = "fixed"
risk_amount = risk_per_trade  # ₹ amount directly

# Quantity
per_share_risk = |entry - stop_loss|   # = ATR
quantity       = floor(risk_amount / per_share_risk)   # minimum 1

# Capital required
capital_required = entry × quantity
```

---

## 7. End-to-End Workflow

### Phase A — Setup

```
1. User connects Upstox account (OAuth token pasted in sidebar)
2. System fetches live balance from Upstox → populates Risk Config capital
3. User sets risk_per_trade and max_concurrent_trades
4. User reviews/edits watchlist (default: ~80 Nifty stocks)
```

---

### Phase B — Auto-Scan (Daily Watchlist)

```
User clicks "Scan" / auto-scan triggers
    ↓
For each symbol in universe (~80 stocks):
    → fetch live quote + indicators (Upstox + ta library)
    → score against 14 weighted criteria
    ↓
Top 30 scored symbols saved to daily_watchlist table
    ↓
Displayed ranked in UI with score, category, action bias, indicator snapshot
User can dismiss or mark as traded
```

---

### Phase C — Trade Card Generation

```
User clicks "Generate Cards" (or pre-open scan before 9:15)
    ↓
For each symbol in watchlist:
    ├── Skip if active card already exists for that symbol
    ├── Fetch live quote via get_live_quote()
    │       → 60 daily candles → compute all 9 indicators
    │       → 15-min intraday → opening range
    │       → Nifty 50 → market direction
    ↓
    Signal Evaluator runs 3-tier system:
    ├── Tier 1 gates (all must pass)
    ├── Tier 2 — score buy vs sell (7 rules × 1pt each)
    ├── Tier 3 — bonus (3 rules × 0.5pt each)
    ↓
    If confidence ≥ "weak" AND risk_reward ≥ 1.5:
        → Calculate qty from risk config
        → Persist TradeCardModel to SQLite
        → Return to frontend
    ↓
Cards displayed in dashboard (filtered by confidence/status)
```

---

### Phase D — Trade Execution

```
User clicks "Execute" on a trade card
    ↓
ExecuteModal opens:
    ├── Shows live Upstox balance (or paper wallet)
    ├── Pre-fills entry price, SL, target, quantity from card
    ├── User selects order type: LIMIT / MARKET / SL / SL-M
    └── Optional: enables Bracket Order toggle
            → SL and target fields become editable
    ↓
User clicks "Place Order"
    ↓
    ┌── Live mode ──────────────────────────────────┐
    │  POST /broker/order                           │
    │  → Upstox POST /v2/order/place                │
    │  If bracket: product="B", squareoff/stoploss  │
    │    offsets calculated from entry price        │
    └───────────────────────────────────────────────┘
    ┌── Paper mode ──────────────────────────────────┐
    │  POST /broker/paper/order                     │
    │  → Fill at real LTP (fetched from Upstox)     │
    │  → Deduct cost from paper wallet              │
    │  → Create PaperPositionModel with SL/target   │
    │  If bracket: SL/target stored on position     │
    │    → auto-exit triggers on next price refresh │
    └───────────────────────────────────────────────┘
```

---

### Phase E — Position Monitoring

```
Open Positions page (auto-refreshes every 10 seconds)
    ↓
GET /broker/positions (live) or /broker/paper/positions (paper)
    ↓
    ┌── Paper mode extra step ──────────────────────┐
    │  For each open position with SL/target set:   │
    │  Fetch live LTP                               │
    │  Buy position: if LTP ≤ SL  → auto-close SL  │
    │                if LTP ≥ TGT → auto-close TGT │
    │  Sell position: reverse logic                 │
    │  → Record BRACKET-SL or BRACKET-Target order  │
    │  → Credit/debit paper wallet                  │
    │  → Store realized_pnl on order                │
    └───────────────────────────────────────────────┘
    ↓
Display: symbol, qty, avg price, LTP, SL, target, P&L, P&L%
    ↓
User can:
    → Click "Chart" → 1-min candlestick + entry/SL/target lines
    → Click "Close" → market order to exit immediately
```

---

### Phase F — P&L Tracking

```
Every manual or bracket close:
    → realized_pnl computed at close time
    → stored on PaperOrderModel (is_close = True)
    ↓
GET /broker/paper/daily-pnl
    → groups by date
    → returns per-day total and individual trade breakdown
    ↓
Positions page shows "Realised P&L History" accordion
    → Expand each date → see symbol, side, type, qty, exit price, P&L
```

---

## 8. Database Schema (summary)

| Table | Purpose |
|---|---|
| `trade_cards` | Generated signal cards with full signal data |
| `risk_config` | Single-row: capital, risk/trade, mode, max trades |
| `watchlist` | User's symbol list (JSON array) |
| `daily_watchlist` | Auto-scan results, one row per symbol per day |
| `api_config` | Upstox access token (persisted across restarts) |
| `paper_wallet` | Single-row: enabled, balance, initial_balance |
| `paper_positions` | Open paper positions with avg_price, SL, target |
| `paper_orders` | All paper orders with realized_pnl, is_close flag |

---

## 9. Key Constraints & Design Decisions

| Decision | Reason |
|---|---|
| Rule-based signals only (no ML) | Explainable, debuggable, no training data needed |
| Live data or no data (no mocks) | Prevents false confidence from simulated signals |
| ATR-based SL (not fixed %) | Adapts to each stock's natural volatility |
| 2:1 R:R minimum (1.5 gate) | Ensures positive expectancy over a series of trades |
| Paper mode uses real LTP | Simulated trades reflect actual market conditions |
| SQLite for persistence | Zero-config, single-file, sufficient for single-user desktop app |
| Upstox token in `api_config` table | Survives API restarts without re-authentication |
