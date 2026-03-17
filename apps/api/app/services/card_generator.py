from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import RiskConfigModel, TradeCardModel
from app.services.risk_calculator import (
    calculate_capital_required,
    calculate_quantity,
    calculate_risk_reward,
)
from app.services.signal_evaluator import evaluate_signal
from app.utils.mock_data import get_mock_quote

MIN_RISK_REWARD = 1.5


def generate_cards(
    symbols: list[str], risk_config: RiskConfigModel, db: Session
) -> list[TradeCardModel]:
    cards = []

    for symbol in symbols:
        quote = get_mock_quote(symbol)
        signal = evaluate_signal(quote)

        if signal.confidence == "none":
            continue

        rr = calculate_risk_reward(signal.entry, signal.stop_loss, signal.target)

        # Gate: require minimum risk/reward and a valid price spread
        if signal.entry == signal.stop_loss or rr < MIN_RISK_REWARD:
            continue

        qty = calculate_quantity(
            risk_config.risk_per_trade, signal.entry, signal.stop_loss
        )
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
            status="valid",
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
