# SRS v1.1 PATCH
## Intraday Trade Card System

---

# 16. Risk Configuration Module

## Purpose
Define user risk parameters that control:
- quantity
- capital allocation
- exposure

---

## Inputs

- Total Capital
- Max Risk Per Trade (₹ or %)
- Max Concurrent Trades (optional)
- Risk Mode (optional)

---

## Behavior

- used in all trade calculations
- quantity auto-adjusted
- invalid trades blocked
- persists across sessions

---

## Validation

- risk < capital
- quantity must be whole number
- capital usage within limits

---

## Output Impact

Affects:
- quantity
- capital usage
- number of trades

---

# 17. Risk Configuration UI

## Fields

- Capital input
- Risk per trade (₹ / % toggle)
- Max trades
- Risk mode

---

## Actions

- Save
- Reset (optional)

---

## Behavior

- instant effect
- inline validation
- optional preview:

Example:
If SL = ₹5 → Qty = 200

---

# 18. Decision Logic Approach

## MVP Definition

System is **rule-based**

---

## Requirements

- deterministic logic
- explainable outputs
- reproducible results

---

## Explanation Requirement

Each trade must show:
- why triggered
- conditions met

---

## Non-AI Constraint

MVP will NOT include:
- ML models
- prediction engines
- black-box logic

---

# 19. Future AI

## Allowed Later

- confidence scoring
- filtering
- behavior insights
- explanations

---

## Constraints

- AI cannot override risk rules
- no auto execution

---

# 20. Trade Card Lifecycle

States:
- Generated
- Valid
- Waiting
- Triggered
- Active
- Invalidated
- Completed

---

## Behavior

- auto state updates
- timestamp logs
- visible status

---

## Invalidation

- price moves too far
- SL hit before entry
- setup breaks

---

# 21. Priority & Filtering

## Priority

Based on:
- strength
- recency
- validity

---

## Filters

- valid only
- active only
- all

---

# 22. Assumptions

- user does external analysis
- system is support tool

---

# 23. Dependencies

- market data API
- internet

---

# 24. Summary

Adds:
- risk config
- UI for risk
- rule-based clarity
- lifecycle states
- filtering
