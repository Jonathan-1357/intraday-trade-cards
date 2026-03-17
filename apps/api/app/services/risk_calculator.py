import math


def calculate_atr_stop_loss(entry: float, atr: float, action: str) -> float:
    """ATR-based stop loss: entry ± 1×ATR depending on direction."""
    if action == "buy":
        return round(entry - atr, 2)
    return round(entry + atr, 2)


def calculate_quantity(risk_amount: float, entry: float, stop_loss: float) -> int:
    """Floor division of risk by per-share risk. Minimum 1."""
    per_share_risk = abs(entry - stop_loss)
    if per_share_risk == 0:
        return 1
    return max(1, math.floor(risk_amount / per_share_risk))


def calculate_risk_reward(entry: float, stop_loss: float, target: float) -> float:
    risk = abs(entry - stop_loss)
    if risk == 0:
        return 0.0
    reward = abs(target - entry)
    return round(reward / risk, 2)


def calculate_capital_required(entry: float, quantity: int) -> float:
    return round(entry * quantity, 2)
