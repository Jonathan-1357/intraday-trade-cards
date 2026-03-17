# API Contracts
## Intraday Trade Card System

Base URL: `http://localhost:8000/api/v1`

---

## Trade Cards

### GET /trade-cards
Returns all non-archived trade cards.

**Query params:**
- `status` — filter by status: `valid | waiting | triggered | active | invalidated | completed`
- `limit` — max results (default: 50)

**Response:**
```json
[
  {
    "id": "string",
    "symbol": "string",
    "action": "buy | sell",
    "entry": 0.0,
    "stop_loss": 0.0,
    "target": 0.0,
    "quantity": 0,
    "confidence": "none | weak | valid | strong",
    "status": "generated | valid | waiting | triggered | active | invalidated | completed",
    "reasons": ["string"],
    "risk_reward": 0.0,
    "capital_required": 0.0,
    "archived": false,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
]
```

---

### GET /trade-cards/{id}
Returns a single trade card (including archived).

**Response:** Single object — same shape as above.

**Errors:** `404` if not found.

---

### POST /trade-cards/generate
Triggers signal evaluation for every symbol in the watchlist and persists passing cards.

Cards are only generated when all Tier 1 hard gates pass and confidence is not `none`.
Each call generates fresh cards — it does not replace existing ones.

**Response:**
```json
{
  "generated": 3,
  "cards": [...]
}
```

---

### POST /trade-cards/refresh
Re-evaluates lifecycle status of all non-terminal, non-archived cards against current quotes.

Terminal statuses (`invalidated`, `completed`) are never re-evaluated.

**Response:**
```json
{ "updated": 2 }
```

---

### POST /trade-cards/archive
Archives one or more cards by ID. Archived cards are hidden from `GET /trade-cards`.

**Body:**
```json
{ "ids": ["uuid1", "uuid2"] }
```

**Response:**
```json
{ "archived": 2 }
```

---

## Risk Config

### GET /risk-config
Returns current risk configuration (always a single row).

**Response:**
```json
{
  "total_capital": 100000.0,
  "risk_per_trade": 1000.0,
  "risk_mode": "fixed | percent",
  "max_concurrent_trades": 5
}
```

---

### PUT /risk-config
Updates risk configuration. Takes effect on the next `POST /generate` call.

**Body:**
```json
{
  "total_capital": 100000.0,
  "risk_per_trade": 1000.0,
  "risk_mode": "fixed",
  "max_concurrent_trades": 5
}
```

**Response:** Updated config object.

---

## Watchlist

### GET /watchlist
Returns the current watchlist.

**Response:**
```json
{ "symbols": ["ICICIBANK", "RELIANCE", "INFY", "HDFCBANK", "TCS"] }
```

---

### PUT /watchlist
Replaces the entire watchlist.

**Body:**
```json
{ "symbols": ["ICICIBANK", "RELIANCE", "INFY"] }
```

**Response:** Updated watchlist object.

---

## Health

### GET /health
```json
{ "status": "ok" }
```
