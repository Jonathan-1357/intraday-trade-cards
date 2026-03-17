# Signal Evaluation Rules
## Intraday Trade Card System

The signal evaluator is rule-based and deterministic. No ML or predictive models are involved.
Every card on screen can be traced back to the exact conditions listed here.

Source: `apps/api/app/services/signal_evaluator.py`

---

## Overview

Evaluation runs in three tiers for each symbol:

```
Tier 1: Hard Gates      — any failure → no card
Tier 2: Confirmation    — 1 point each (max 7)
Tier 3: Bonus           — 0.5 points each (max 1.5)
```

Total possible score: **8.5 points**

Direction (buy vs sell) is determined by whichever side scores higher. Buy wins on a tie.

---

## Tier 1: Hard Gates

All gates are direction-agnostic and evaluated first.
**Any single failure kills the card — it will not appear.**

| Gate | Condition | Why |
|---|---|---|
| Time window | `in_time_window == True` | Avoid open noise and late-day chop |
| Not near circuit | `near_circuit == False` | Avoid stocks about to halt |
| Volume ratio | `volume / avg_volume >= 0.5` | Minimum liquidity; avoids slippage |
| ATR minimum | `atr >= ₹5` | Stock must have enough range to trade |
| SL valid | `atr_stop_loss > 0 AND entry != sl` | Ensures quantity calculation is sane |

The SL validity gate is checked after direction is determined, since ATR-based SL direction depends on buy vs sell.

---

## Tier 2: Confirmation Rules

Scored after direction is chosen. Each passing rule adds **1 point**.

### Buy Confirmation (7 rules)

| Rule | Condition | Reason shown on card |
|---|---|---|
| Price above VWAP | `price > vwap` | "price above VWAP" |
| RSI bullish zone | `55 ≤ rsi ≤ 73` | "RSI {value} in bullish zone (55–73)" |
| EMA stack bullish | `price > ema9 AND ema9 > ema21` | "EMA stack bullish (price > ema9 > ema21)" |
| MACD positive | `macd_histogram > 0` | "MACD histogram positive" |
| OBV up | `obv_direction == "up"` | "OBV trending up" |
| Nifty aligned | `nifty_direction != "down"` | "Nifty {direction} (not against trade)" |
| StochRSI not overbought | `stoch_rsi < 80` | "StochRSI {value} below overbought (< 80)" |

### Sell Confirmation (7 rules)

| Rule | Condition | Reason shown on card |
|---|---|---|
| Price below VWAP | `price < vwap` | "price below VWAP" |
| RSI bearish zone | `27 ≤ rsi ≤ 45` | "RSI {value} in bearish zone (27–45)" |
| EMA stack bearish | `price < ema9 AND ema9 < ema21` | "EMA stack bearish (price < ema9 < ema21)" |
| MACD negative | `macd_histogram < 0` | "MACD histogram negative" |
| OBV down | `obv_direction == "down"` | "OBV trending down" |
| Nifty aligned | `nifty_direction != "up"` | "Nifty {direction} (not against trade)" |
| StochRSI not oversold | `stoch_rsi > 20` | "StochRSI {value} above oversold (> 20)" |

---

## Tier 3: Bonus Rules

Each passing bonus rule adds **0.5 points**. Shown on card with `[+]` prefix.

### Buy Bonus (3 rules)

| Rule | Condition | Reason shown on card |
|---|---|---|
| Opening range breakout | `or_breakout == "up"` | "[+] opening range breakout (up)" |
| Sector aligned | `sector_direction == "up"` | "[+] sector trending up" |
| Bollinger squeeze | `bb_width < 0.02` | "[+] Bollinger squeeze (width {value} < 2%)" |

### Sell Bonus (3 rules)

| Rule | Condition | Reason shown on card |
|---|---|---|
| Opening range breakout | `or_breakout == "down"` | "[+] opening range breakout (down)" |
| Sector aligned | `sector_direction == "down"` | "[+] sector trending down" |
| Bollinger squeeze | `bb_width < 0.02` | "[+] Bollinger squeeze (width {value} < 2%)" |

---

## Confidence Scoring

| Score | Confidence | Meaning |
|---|---|---|
| 0–1 | `none` | Card not generated |
| 2–3 | `weak` | Marginal setup — few signals agree |
| 4–5 | `valid` | Reasonable setup — majority aligned |
| 6+ | `strong` | High-conviction — most signals agree |

Score = sum of all passing Tier 2 (1pt each) + Tier 3 (0.5pt each).

---

## Stop Loss Calculation

SL is ATR-based, not raw high/low of day:

```
Buy:  SL = entry - 1.0 × ATR
Sell: SL = entry + 1.0 × ATR
```

ATR is the Average True Range — a measure of how much a stock typically moves per day.
Using 1×ATR prevents SL from being too tight (hit by normal noise) or too wide (unfavorable R:R).

---

## Target Calculation

Target enforces a minimum 2:1 reward-to-risk ratio:

```
Buy:  target = entry + 2 × (entry - SL)
Sell: target = entry - 2 × (SL - entry)
```

Cards with a computed R:R below 1.5 are discarded by `card_generator.py`.

---

## Evaluation Flow (step by step)

```
1. Fetch quote for symbol
2. Run Tier 1 gates (direction-agnostic)
   → Any fail? Return confidence=none, no card
3. Score BUY rules (Tier 2 + Tier 3)
4. Score SELL rules (Tier 2 + Tier 3)
5. Pick direction with higher score (buy wins ties)
6. Compute ATR-based SL and target
7. Check SL validity gate
   → Fail? Return confidence=none, no card
8. Convert score to confidence
9. Assemble reasons list (passing rules only)
10. Return SignalResult
```

---

## Adding New Rules

Each rule is a standalone function with signature:

```python
def rule_name(q: dict) -> tuple[bool, str]:
    return <condition>, "<reason string>"
```

To add a Tier 2 rule: implement the function, add it to `_BUY_CONF_RULES` or `_SELL_CONF_RULES`.
To add a Tier 3 rule: implement the function, add it to `_BUY_BONUS_RULES` or `_SELL_BONUS_RULES`.
To add a Hard Gate: implement the function, add it to `_HARD_GATES`.

No other code needs to change.

---

## Data Sources

For MVP, all indicator values come from `apps/api/app/utils/mock_data.py`.
Each field is seeded deterministically by `hash(symbol)` — same symbol always produces the same quote.

See `docs/data-models.md` for the full list of fields returned by `get_mock_quote()`.

When connecting to real market data, replace `get_mock_quote()` only.
The evaluator, risk calculator, and generator have no dependency on how the data was obtained.
