from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import RiskConfigModel, TradeCardModel
from app.services.risk_calculator import (
    calculate_capital_required,
    calculate_quantity,
    calculate_risk_reward,
)
from fastapi import HTTPException

from app.config import settings
from app.services.signal_evaluator import evaluate_signal

MIN_RISK_REWARD = 1.5


def _get_quote(symbol: str) -> dict:
    """Use live Upstox data. Raises 503 if no token is configured."""
    if not settings.upstox_access_token:
        raise HTTPException(503, "No live data — connect Upstox first")
    from app.utils.market_data import get_live_quote
    return get_live_quote(symbol, settings.upstox_access_token)


def generate_cards(
    symbols: list[str],
    risk_config: RiskConfigModel,
    db: Session,
    preopen: bool = False,
) -> list[TradeCardModel]:
    # Build set of symbols that already have a live (non-terminal) card
    terminal = {"invalidated", "completed"}
    existing = {
        row.symbol
        for row in db.query(TradeCardModel.symbol)
        .filter(
            TradeCardModel.archived == False,  # noqa: E712
            TradeCardModel.status.notin_(terminal),
        )
        .all()
    }

    cards = []

    for symbol in symbols:
        if symbol in existing:
            continue

        quote = _get_quote(symbol)
        signal = evaluate_signal(quote, bypass_time_gate=preopen)

        if signal.confidence == "none":
            continue

        # Pre-open mode: only suggest buy orders
        if preopen and signal.action != "buy":
            continue

        rr = calculate_risk_reward(signal.entry, signal.stop_loss, signal.target)

        # Gate: require minimum risk/reward and a valid price spread
        if signal.entry == signal.stop_loss or rr < MIN_RISK_REWARD:
            continue

        if risk_config.risk_mode == "percent":
            risk_amount = (risk_config.risk_per_trade / 100) * risk_config.total_capital
        else:
            risk_amount = risk_config.risk_per_trade

        qty = calculate_quantity(risk_amount, signal.entry, signal.stop_loss)
        capital = calculate_capital_required(signal.entry, qty)

        card = TradeCardModel(
            id=str(uuid4()),
            symbol=symbol,
            action=signal.action,
            entry=signal.entry,
            stop_loss=signal.stop_loss,
            target=signal.target,
            quantity=qty,
            confidence=signal.confidence,
            status="pre_open" if preopen else "valid",
            reasons=signal.reasons,
            risk_reward=rr,
            capital_required=capital,
        )
        db.add(card)
        cards.append(card)

    db.commit()
    for card in cards:
        db.refresh(card)

    return cards
