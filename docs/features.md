# IRIS EDGE — Feature Reference

**Version**: Current (post-paper-trading)
**Stack**: FastAPI + Next.js 14 + SQLite + Upstox v2 API

---

## 1. Trade Card Generation (IRIS IQ)

### What it does
Analyses every symbol in the user's watchlist and produces actionable trade cards for intraday entries.

### How it works
1. User clicks **AI Trade Insights** on the IRIS IQ dashboard.
2. Backend fetches the watchlist, skips any symbol that already has a live (non-terminal) card.
3. For each symbol, pulls a quote — live from Upstox if connected, deterministic mock otherwise.
4. A 3-tier signal evaluator scores the quote (see `signal-rules.md`).
5. Cards with confidence `weak` and above are saved if R:R ≥ 1.5×.
6. The frontend refreshes and shows the new cards.

### Card fields
| Field | Description |
|---|---|
| `symbol` | NSE trading symbol |
| `action` | `buy` or `sell` |
| `entry` | Suggested entry price |
| `stop_loss` | ATR-based stop level |
| `target` | 2× risk projection |
| `quantity` | Shares to trade (risk-sized) |
| `confidence` | `weak` / `valid` / `strong` |
| `status` | Lifecycle state (see §3) |
| `reasons` | Human-readable rule list |
| `risk_reward` | Target distance ÷ stop distance |
| `capital_required` | entry × quantity |

### Pre-Open mode
When the market is closed and the user clicks Generate, a confirmation modal appears. Confirming calls `POST /trade-cards/preopen` which:
- Generates **buy-only** cards
- Bypasses the time-window gate
- Marks cards with status `pre_open` (amber banner on card)

---

## 2. Trade Card Lifecycle

Cards move through states as price evolves:

```
generated/valid → waiting → triggered → active → completed
                                              ↘ invalidated
pre_open ──────→ (transitions on market open)
```

| Status | Meaning |
|---|---|
| `valid` | Generated, ready to act on |
| `pre_open` | Generated before market open |
| `waiting` | Monitoring for entry price hit |
| `triggered` | Entry price reached |
| `active` | Position is open |
| `completed` | Target hit — trade closed profitably |
| `invalidated` | Stop loss hit — trade closed at a loss |

**Refresh**: `POST /trade-cards/refresh` re-evaluates all non-terminal cards against the latest quote.

---

## 3. Filter Bar (Dashboard)

Tabs above the card grid filter by status:
- **All** — every card regardless of state
- **Valid** — ready-to-trade cards
- **Waiting / Triggered / Active** — in-progress
- **Invalidated / Completed** — terminal

Filter is reflected in the URL as `?status=valid` so it can be bookmarked.

---

## 4. Summary Bar (Dashboard)

Four KPI tiles shown at the top of the IRIS IQ dashboard:

| Tile | Calculation |
|---|---|
| Total Cards | Count of all non-archived cards |
| Strong / Valid / Weak | Count per confidence level |
| Capital Deployed | Sum of `capital_required` for active cards |
| Slots Available | `max_concurrent_trades − active_count` |

---

## 5. Risk Configuration

### Location
`/config` page — "Risk Config" in the left nav.

### Settings
| Setting | Description | Default |
|---|---|---|
| Total Capital | Trading capital (₹) — read from Upstox in live mode | ₹1,00,000 |
| Risk per Trade | Fixed ₹ or % of capital per trade | ₹1,000 |
| Risk Mode | `fixed` or `percent` | fixed |
| Max Concurrent Trades | Slot limit enforced by card generator | 5 |

### Capital display
- **Live mode**: fetches `GET /broker/funds` on load; shows Upstox balance read-only with a "↻ refresh" badge.
- **Paper mode**: editable input, pre-seeded from paper wallet balance; saving also writes back to the paper wallet.

### Exposure summary
Shows: risk per trade, max total risk (`risk × max_trades`), and % of capital at risk with red warning at > 10%.

---

## 6. Watchlist Management

### My Watchlist tab
- Add symbols by typing an NSE code + Enter (validated against Upstox instruments list).
- Remove by clicking the ✕ on each chip.
- Changes saved immediately to `PUT /watchlist`.
- Each symbol shows its active card (if any) below its name.

### Auto-Scan tab
- Click **Auto-Scan Market** to score 100+ NSE symbols.
- Top 30 ranked by composite score are persisted as today's entries.
- Entries grouped into categories: Gap Up Momentum, Gap Down Reversal, Breakout Candidate, High Volume Mover, Strong Momentum.
- Each entry shows score bar, directional action, and expandable "Why this stock?" indicator detail.
- Actions: **Add to Watchlist**, **Mark Traded**, **Dismiss**.

---

## 7. Auto-Watchlist Scoring Engine

### Scoring factors (14 criteria)

| Factor | Buy pts | Sell pts |
|---|---|---|
| Gap > 1% | +15 | — |
| Gap < -1% | — | +10 |
| Volume spike > 2× avg | +20 | +12 |
| RSI 55–73 (bullish) | +10 | — |
| RSI 27–45 (reversal) | — | +8 |
| EMA bullish stack | +10 | — |
| EMA bearish stack | — | +8 |
| MACD positive | +5 | — |
| Sector trending up | +10 | +5 |
| ATR > ₹10 | +10 | — |
| OR breakout up | +15 | — |
| OR breakout down | — | +8 |
| Nifty aligned | +5 | — |
| Low liquidity | −25 | −25 |
| Near circuit | −10 | −10 |

Top 30 by total score are saved each day. Action direction is set by whether bullish or bearish tags dominate.

---

## 8. Symbol Detail Panel + Chart

Clicking a symbol in the watchlist opens a detail panel with:
- Live quote: LTP, day change, OHLCV
- Candlestick chart (lightweight-charts v5)

### Chart timeframes

| Button | Interval | Data range |
|---|---|---|
| 1H | 1 minute | Last 60 bars |
| 1D | 1 minute | Last 375 bars (1 full session) |
| 1W | 15 minute | 7 days |
| 1M | 30 minute | 30 days |
| 3M | 60 minute* | 90 days |
| 6M | 120 minute* | 180 days |
| 1Y | Day | 365 days |

\* `60min` and `120min` are built by aggregating `30min` candles (×2 and ×4) since Upstox doesn't support these intervals natively.

**Timezone**: All intraday timestamps are shifted +5:30 (IST offset = 19800 s) so the chart displays correct Indian market hours.

---

## 9. Upstox Connection

### Indicator
Bottom of the left nav shows:
- 🟢 **Live · Connected** — token valid and API responding
- 🟡 **Token invalid** — token saved but Upstox ping failed
- ⚫ **Click to connect** — no token configured

### Configuration modal
Click the indicator to open the connection modal:
- Paste a Upstox JWT access token
- Click **Connect** — token is saved to DB and applied in-memory immediately (no restart needed)
- **Disconnect** clears the token

All features work without a token using deterministic mock data.

---

## 10. Execute Order

### Button location
Each trade card has an **Execute** button in the footer.

### Modal flow
1. Opens a portal modal showing the card's symbol and action.
2. Displays available margin (Upstox in live mode, paper wallet in paper mode).
3. User can edit: price, quantity, order type (LIMIT / MARKET / SL / SL-M), trigger price.
4. Estimated cost is calculated live; insufficient margin shown in red.
5. **Place Order** calls:
   - Live mode → `POST /broker/order` (real Upstox)
   - Paper mode → `POST /broker/paper/order` (virtual)
6. Success screen shows order ID and mock/paper/live label.

---

## 11. Open Positions

### Location
`/positions` page — "Open Positions" in the left nav.

### Content
**P&L Summary tiles** (3 across):
- Total P&L with percentage
- Number of open positions
- Capital deployed at average price

**Positions table**: Symbol, Qty, Avg Price, LTP, P&L, P&L %, Close button.

**Orders table**: Symbol, Side, Type, Qty, Price, Status, Time.

**Close button**: Places an opposing MARKET order to flatten the position.

### Paper vs Live
When paper mode is active, all data comes from the paper positions/orders DB. An indigo banner shows the current paper balance. Toggling paper mode instantly switches the data source.

---

## 12. Paper Trading

### Purpose
Simulate trades using real market data (or mock when offline) with virtual money — no real orders placed.

### Enable
Toggle switch in the bottom of the left nav. Click the label to open the Paper Wallet modal.

### Paper Wallet modal
- **Preset buttons**: Add ₹10K, ₹25K, ₹50K, ₹1L, ₹2.5L instantly.
- **Custom amount**: Type any value + Add.
- **Balance summary**: shows current balance, initial capital, and P&L.
- **Disable paper mode**: returns to live mode.

### Order execution in paper mode
- Fills at market LTP (real Upstox LTP if connected, mock price otherwise).
- LIMIT orders fill at the specified limit price.
- Balance decremented on buy, credited on sell/close.
- Average price tracked for partial fills.

### Capital sync
Setting Total Capital in Risk Config while in paper mode also sets the paper wallet balance via `PUT /broker/paper/status`.

---

## 13. Mock Data Mode

When no Upstox token is configured, every data-dependent feature falls back to deterministic mock data:
- Quotes are seeded by `hash(symbol)` — same symbol always returns the same price/indicators within a process run.
- Mock positions and orders are returned with `"mock": true`.
- Mock funds return ₹1,25,000 available margin.
- All chart candles are synthesised OHLCV series.

This means the entire app is fully functional without any broker connection.
