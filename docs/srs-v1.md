# Software Requirements Specification (SRS)
## Product Name
Intraday Trade Card System

## Version
v1.0

---

# 1. Introduction

## 1.1 Purpose
This document defines the requirements for a simple intraday trading support system that generates structured trade cards.

The system focuses on:
- generating actionable trade cards
- showing clear trade suggestions
- validating setups
- calculating quantity based on risk
- presenting decisions in a single screen

---

## 1.2 Product Objective
A desktop-first web app that answers:

- Which stock?
- Buy or Sell?
- Entry price?
- Stop loss?
- Target?
- Quantity?
- Why this trade?
- Is it valid?

---

## 1.3 Positioning
This is NOT:
- a trading platform
- a broker terminal
- an automated trading bot

This is a:
**Trade Suggestion and Validation System**

---

# 2. Scope

## 2.1 In Scope
- watchlist monitoring
- trade card generation
- entry/SL/target calculation
- quantity calculation
- validation checks
- confidence indication
- reasoning summary
- dashboard view
- invalidation logic

## 2.2 Out of Scope
- broker integration
- auto trading
- options logic
- ML/AI prediction
- mobile app
- multi-user
- backtesting

---

# 3. Users

## Primary User
Intraday trader using desktop

---

# 4. Core Concept

System generates **Trade Cards**

Each card contains:
- symbol
- action
- entry
- stop loss
- target
- quantity
- confidence
- status
- reason

---

# 5. Sample Trade Card

Stock: ICICI Bank  
Action: Buy  
Entry: ₹1062  
Stop Loss: ₹1054  
Target: ₹1076  
Quantity: 125  
Status: Valid  
Confidence: Strong  

Reason:
- price above VWAP
- RSI strong
- volume spike

---

# 6. Modules

1. Watchlist Module  
2. Signal Evaluation Module  
3. Trade Card Generator  
4. Validation Module  
5. Risk & Quantity Module  
6. Dashboard  

---

# 7. Functional Requirements

## 7.1 Watchlist
- predefined stocks
- real-time tracking
- basic indicators

---

## 7.2 Signal Evaluation
System checks:
- price conditions
- volume
- momentum

Classification:
- none
- weak
- valid
- strong

---

## 7.3 Trade Card Generation
Each card must include:
- symbol
- buy/sell
- entry
- stop loss
- target
- quantity
- confidence
- status
- reason

---

## 7.4 Validation
States:
- valid
- waiting
- triggered
- invalidated
- completed

Invalidation if:
- setup breaks
- price moves away
- conditions fail

---

## 7.5 Risk & Quantity

Formula:
Quantity = Risk / (Entry - Stop Loss)

System shows:
- quantity
- capital required
- risk-reward

---

## 7.6 Dashboard

Displays:
- trade cards
- status
- confidence
- reasons

---

# 8. UI

## Main Screen

### Sections:
- Header
- Trade Cards Grid
- Optional Alerts Panel

---

# 9. Data

## Inputs
- price
- volume
- OHLC
- indicators

## Outputs
- entry
- stop loss
- target
- quantity

---

# 10. Rules

- Only valid setups create cards
- Quantity must follow risk
- Invalid setups removed

---

# 11. Non-Functional

- fast updates
- high readability
- simple UI
- modular logic

---

# 12. Architecture

Frontend:
- React / Next.js

Backend:
- FastAPI

Storage:
- SQLite (MVP)

---

# 13. Entities

## Trade Card
- id
- symbol
- action
- entry
- stop_loss
- target
- quantity
- confidence
- status
- reason

---

# 14. Acceptance Criteria

- trade cards generated
- quantity calculated
- validation works
- dashboard updates
- user can act on cards

---

# 15. Future Enhancements

- AI scoring
- behavioral layer
- mobile app
- broker integration


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