from app.models import TradeCardModel

_TERMINAL = {"invalidated", "completed"}


def refresh_card_status(card: TradeCardModel, quote: dict) -> bool:
    """
    Evaluate lifecycle transition based on current price.
    Returns True if status changed.
    """
    if card.status in _TERMINAL:
        return False

    price = quote["price"]
    changed = False
    new_status = card.status

    if card.action == "buy":
        if card.status in ("generated", "valid"):
            new_status = "waiting"
        elif card.status == "waiting":
            if price <= card.entry:
                new_status = "triggered"
        elif card.status == "triggered":
            if price <= card.stop_loss:
                new_status = "invalidated"
            elif price >= card.target:
                new_status = "completed"
            else:
                new_status = "active"
        elif card.status == "active":
            if price <= card.stop_loss:
                new_status = "invalidated"
            elif price >= card.target:
                new_status = "completed"

    else:  # sell
        if card.status in ("generated", "valid"):
            new_status = "waiting"
        elif card.status == "waiting":
            if price >= card.entry:
                new_status = "triggered"
        elif card.status == "triggered":
            if price >= card.stop_loss:
                new_status = "invalidated"
            elif price <= card.target:
                new_status = "completed"
            else:
                new_status = "active"
        elif card.status == "active":
            if price >= card.stop_loss:
                new_status = "invalidated"
            elif price <= card.target:
                new_status = "completed"

    if new_status != card.status:
        card.status = new_status
        changed = True

    return changed
