# Signal Evaluation Rules
## IRIS EDGE — Intraday Trade Card System

The signal evaluator is rule-based and deterministic. No ML or predictive models are involved.
Every card on screen can be traced back to the exact conditions listed here.

---

## Overview

Evaluation runs in three sequential tiers:

1. **Hard Gates** — all must pass; any failure → no card generated
2. **Confirmation Rules** — each rule scores 1 point; minimum 2 required to proceed
3. **Bonus Rules** — each scores 0.5 points; added to confirmation score

Final **confidence** is mapped from total score:

| Score | Confidence |
|---|---|
| ≥ 6 | `strong` |
| ≥ 4 | `valid` |
| ≥ 2 | `weak` |
| < 2 | `none` (card not created) |

Cards with confidence `none` are discarded. All other cards still require **R:R ≥ 1.5×** to be saved.

---

## Tier 1 — Hard Gates

All five gates must pass. Any single failure means no card is created for that symbol.

| Gate | Condition |
|---|---|
| `gate_in_time_window` | Current time is between 09:15 and 15:30 IST. Bypassed in pre-open mode. |
| `gate_not_near_circuit` | Price is not within 2% of the circuit breaker (upper or lower). |
| `gate_volume_ratio` | Current volume ÷ average volume ≥ 0.5 |
| `gate_atr_minimum` | ATR ≥ ₹5 (ensures the instrument has meaningful price movement) |
| `gate_sl_valid` | Computed stop_loss > 0 and stop_loss ≠ entry |

---

## Tier 2 — Confirmation Rules (1 point each)

At least **2 points** are required to proceed.

### BUY confirmation rules

| Rule | Condition |
|---|---|
| `rule_price_above_vwap` | price > VWAP |
| `rule_rsi_bullish` | RSI between 55 and 73 |
| `rule_ema_bullish_stack` | price > EMA9 > EMA21 |
| `rule_macd_positive` | MACD > 0 |
| `rule_obv_trending_up` | OBV rising (positive slope) |
| `rule_nifty_not_down` | Nifty 50 EMA9 ≥ EMA21 (market not in downtrend) |
| `rule_stochrsi_not_overbought` | StochRSI < 80 |

### SELL confirmation rules

| Rule | Condition |
|---|---|
| `rule_price_below_vwap` | price < VWAP |
| `rule_rsi_bearish` | RSI between 27 and 45 |
| `rule_ema_bearish_stack` | price < EMA9 < EMA21 |
| `rule_macd_negative` | MACD < 0 |
| `rule_obv_trending_down` | OBV falling (negative slope) |
| `rule_nifty_not_up` | Nifty 50 EMA9 ≤ EMA21 (market not in uptrend) |
| `rule_stochrsi_not_oversold` | StochRSI > 20 |

---

## Tier 3 — Bonus Rules (0.5 points each)

### BUY bonus rules

| Rule | Condition |
|---|---|
| `bonus_or_breakout_up` | Price has broken above the opening range high |
| `bonus_sector_up` | Sector is trending upward (sector proxy EMA9 > EMA21) |
| `bonus_bb_squeeze` | Bollinger Band width < 2% (low volatility compression) |

### SELL bonus rules

| Rule | Condition |
|---|---|
| `bonus_or_breakout_down` | Price has broken below the opening range low |
| `bonus_sector_down` | Sector is trending downward |
| `bonus_bb_squeeze` | Same squeeze condition as buy |

---

## Entry, Stop Loss, and Target Calculation

### ATR-based stop loss
```
stop_loss (buy)  = entry − 1 × ATR
stop_loss (sell) = entry + 1 × ATR
```

### Target (2× risk projection)
```
risk   = abs(entry − stop_loss)
target (buy)  = entry + 2 × risk
target (sell) = entry − 2 × risk
```

### Quantity (risk-based sizing)
```
risk_amount  = risk_per_trade            (if mode = "fixed")
risk_amount  = total_capital × (risk_per_trade / 100)   (if mode = "percent")
per_share_risk = abs(entry − stop_loss)
quantity     = floor(risk_amount / per_share_risk)
quantity     = max(quantity, 1)
```

### Risk/Reward
```
risk_reward = abs(target − entry) / abs(entry − stop_loss)
```
Cards with R:R < 1.5 are discarded regardless of confidence.

---

## Pre-Open Mode

When `POST /trade-cards/preopen` is called:
- `gate_in_time_window` is **bypassed**
- Only **BUY** cards are generated (sell signals are not evaluated)
- Cards receive status `pre_open` (shown with an amber banner in the UI)
- All other tiers and filters apply normally

---

## Quote Data Source

Each evaluation uses a quote dict containing:

| Field | Used by |
|---|---|
| `price` | Entry, gate checks |
| `vwap` | VWAP confirmation rules |
| `rsi` | RSI rules |
| `ema9`, `ema21`, `ema50` | EMA stack rules |
| `macd` | MACD rule |
| `obv` | OBV trending rule |
| `stoch_rsi` | StochRSI rules |
| `atr` | ATR gate, stop loss |
| `volume`, `avg_volume` | Volume ratio gate |
| `volume_ratio` | Volume confirmation |
| `bb_width` | Bollinger Band squeeze |
| `or_breakout` | OR breakout bonus |
| `sector_direction` | Sector bonus |
| `nifty_direction` | Nifty alignment rule |
| `near_circuit` | Circuit gate |
| `in_time_window` | Time gate |

**Live data**: Fetched from Upstox v2 market quote + historical candles (for ATR, EMA, MACD, OBV computation via the `ta` library).

**Mock data**: Deterministically generated using `hash(symbol)` as seed. Same symbol always produces the same indicators within a process run.

---

## Reason Strings

Each passing rule appends a human-readable string to `card.reasons`. Examples:

- `"Price above VWAP — momentum confirmed"`
- `"RSI at 62.5 — bullish zone"`
- `"EMA bullish stack — trending up"`
- `"MACD positive — upward momentum"`
- `"Opening range breakout — strength confirmed"`
- `"Volume spike 2.8× average — institutional interest"`

These strings appear verbatim on the trade card in the UI.

---

## Deduplication

Before generating cards, the backend queries for existing non-archived, non-terminal cards. Any symbol already present in those results is skipped entirely — the same symbol will not get a duplicate card until the existing one reaches a terminal state (`completed` or `invalidated`).

Terminal states: `completed`, `invalidated`
Non-terminal states (blocks re-generation): `generated`, `valid`, `pre_open`, `waiting`, `triggered`, `active`
