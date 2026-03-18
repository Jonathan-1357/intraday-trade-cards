# API Contracts
## IRIS EDGE — Intraday Trade Card System

Base URL: `http://localhost:8000/api/v1`

All endpoints return JSON. All write operations accept `Content-Type: application/json`.

---

## Trade Cards

### `GET /trade-cards`
List all trade cards, newest first. Max 50 returned.

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by card status (optional) |

**Response** — array of TradeCard objects:
```json
[
  {
    "id": "uuid",
    "symbol": "RELIANCE",
    "action": "buy",
    "entry": 2450.50,
    "stop_loss": 2420.00,
    "target": 2511.50,
    "quantity": 32,
    "confidence": "valid",
    "status": "valid",
    "reasons": ["Price above VWAP", "RSI in bullish zone"],
    "risk_reward": 2.0,
    "capital_required": 78416.00,
    "archived": false,
    "created_at": "2026-03-19T09:25:00",
    "updated_at": "2026-03-19T09:25:00"
  }
]
```

---

### `GET /trade-cards/{card_id}`
Single card by ID. Returns `404` if not found.

---

### `POST /trade-cards/generate`
Generate trade cards for all watchlist symbols. Skips symbols with an existing live (non-terminal) card.

**Response**:
```json
{
  "generated": 3,
  "cards": [],
  "skipped_symbols": ["TCS", "INFY"]
}
```

---

### `POST /trade-cards/preopen`
Generate buy-only pre-open cards (bypasses the market-hours time gate).

**Response** — same shape as `/generate`.

---

### `POST /trade-cards/refresh`
Re-evaluate all non-terminal cards against current prices and advance statuses.

**Response**: `{ "updated": 5 }`

---

### `POST /trade-cards/archive`
Bulk soft-delete cards.

**Body**: `{ "ids": ["uuid1", "uuid2"] }`

**Response**: `{ "archived": 2 }`

---

## Risk Config

### `GET /risk-config`
```json
{
  "id": 1,
  "total_capital": 100000.0,
  "risk_per_trade": 1000.0,
  "risk_mode": "fixed",
  "max_concurrent_trades": 5
}
```

### `PUT /risk-config`
All fields optional. `risk_mode`: `"fixed"` | `"percent"`.

---

## Watchlist

### `GET /watchlist`
```json
{ "symbols": ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"] }
```

### `PUT /watchlist`
**Body**: `{ "symbols": ["RELIANCE", "BAJFINANCE"] }`

---

## Market Data

### `GET /market/search?q=`
Search NSE instruments. Falls back to 100-stock hardcoded universe if instruments list unavailable.

**Response**: `[{ "symbol": "RELIANCE", "name": "Reliance Industries Ltd" }]`

---

### `GET /market/quote/{symbol}`
Live or mock quote with all indicators.

**Response**:
```json
{
  "symbol": "RELIANCE",
  "price": 2450.50,
  "open": 2430.0, "high": 2465.0, "low": 2420.0, "close": 2440.0,
  "volume": 1250000, "avg_volume": 980000, "vwap": 2442.0,
  "rsi": 62.5, "ema9": 2435.0, "ema21": 2420.0, "ema50": 2400.0,
  "macd": 8.5, "atr": 32.0, "mock": false
}
```

---

### `GET /market/candles/{symbol}`

| Param | Description |
|---|---|
| `interval` | `day` \| `1minute` \| `15minute` \| `30minute` \| `60minute` \| `120minute` |
| `days` | Calendar days (default 30) |
| `last_n` | Trim to last N bars (optional) |

`60minute` and `120minute` are built by aggregating `30minute` candles (×2 / ×4).
Intraday timestamps include IST offset (+19800 s) for correct chart display.

**Response**:
```json
[{ "time": 1710825000, "open": 2430.0, "high": 2465.0, "low": 2420.0, "close": 2450.5, "volume": 125000 }]
```

---

## Auto-Watchlist

### `POST /auto-watchlist/generate`
Score 100+ stocks, persist top 30 for today. Wipes today's previous entries first.

**Response**: `{ "generated": 30, "date": "2026-03-19" }`

---

### `GET /auto-watchlist/today`
Today's entries grouped by category.

**Response**:
```json
{
  "date": "2026-03-19",
  "categories": {
    "Gap Up Momentum": [{
      "id": "uuid",
      "symbol": "BAJFINANCE",
      "score": 72,
      "rank": 1,
      "action": "buy",
      "reason_tags": ["gap_up", "volume_spike", "rsi_bullish"],
      "indicator_snapshot": { "gap_pct": 2.1, "volume_ratio": 2.8, "rsi": 61.0 },
      "dismissed": false,
      "traded": false
    }]
  }
}
```

---

### `POST /auto-watchlist/{entry_id}/dismiss`
Mark entry dismissed. **Response**: `{ "ok": true }`

### `POST /auto-watchlist/{entry_id}/traded`
Mark entry traded. **Response**: `{ "ok": true }`

---

## System

### `GET /system/connection`
```json
{ "connected": true, "has_token": true, "token_preview": "eyJhbGci…abc" }
```
`connected` requires a successful live HTTP ping to Upstox.

### `PUT /system/connection`
**Body**: `{ "token": "eyJ..." }` — pass empty string to disconnect.
Applied immediately in-memory; no restart needed.

---

## Broker (Live)

All endpoints degrade gracefully to mock data when no Upstox token is set.

### `GET /broker/funds`
```json
{ "available_margin": 125000.00, "used_margin": 32500.00, "total_balance": 157500.00, "mock": true }
```

---

### `POST /broker/order`
**Body**:
```json
{
  "symbol": "RELIANCE",
  "action": "buy",
  "order_type": "LIMIT",
  "price": 2450.50,
  "trigger_price": 0,
  "quantity": 10,
  "product": "I"
}
```

`order_type`: `LIMIT` | `MARKET` | `SL` | `SL-M`
`product`: `I` (intraday) | `D` (delivery)
`trigger_price`: set > 0 only for `SL` / `SL-M`

**Response**: `{ "order_id": "250319000123456", "status": "placed", "mock": false }`

---

### `GET /broker/positions`
```json
{
  "positions": [{
    "symbol": "RELIANCE", "quantity": 10,
    "buy_avg": 2450.0, "sell_avg": 0.0, "ltp": 2480.5,
    "pnl": 305.0, "pnl_pct": 1.24, "product": "I"
  }],
  "mock": false
}
```

---

### `GET /broker/orders`
```json
{
  "orders": [{
    "order_id": "250319000123456", "symbol": "RELIANCE",
    "action": "buy", "order_type": "LIMIT", "quantity": 10,
    "price": 2450.0, "avg_price": 2451.5, "status": "complete", "placed_at": "09:17:32"
  }],
  "mock": false
}
```

---

### `POST /broker/close`
**Body**: `{ "symbol": "RELIANCE", "quantity": 10, "action": "sell" }`
Places an opposing MARKET order. Response same as `/broker/order`.

---

## Paper Trading

### `GET /broker/paper/status`
```json
{ "enabled": true, "balance": 87500.00, "initial_balance": 100000.00 }
```

### `PUT /broker/paper/status`
**Body** (all optional):
```json
{ "enabled": true, "add_funds": 50000, "set_balance": 100000 }
```
`add_funds` increments balance. `set_balance` replaces balance AND resets `initial_balance`.

---

### `POST /broker/paper/order`
Same body shape as `POST /broker/order`. Fills at real LTP (Upstox if connected, mock otherwise).

**Response**:
```json
{
  "order_id": "PAPER-A1B2C3D4",
  "executed_price": 2450.50,
  "status": "complete",
  "paper": true,
  "balance_after": 69995.00
}
```

---

### `GET /broker/paper/positions`
```json
{
  "positions": [{
    "symbol": "RELIANCE", "action": "buy", "quantity": 10,
    "average_price": 2450.0, "last_price": 2480.5,
    "pnl": 305.0, "pnl_pct": 1.24, "product": "PAPER", "exchange": "NSE", "paper": true
  }],
  "paper": true
}
```

### `GET /broker/paper/orders`
Last 50 paper orders, newest first. Same shape as `/broker/orders` with `"paper": true`.

### `POST /broker/paper/close`
**Body**: `{ "symbol": "RELIANCE", "quantity": 10 }`
Closes at market LTP. Response same as `POST /broker/paper/order`.

---

## Health

### `GET /health`
```json
{ "status": "ok" }
```
