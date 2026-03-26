"""
Broker execution routes — Upstox order placement, funds, and positions.
Requires a valid Upstox token; raises 403 if none is configured.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models import TradeCardModel

router = APIRouter()


def _token() -> str:
    t = settings.upstox_access_token
    if not t:
        raise HTTPException(403, "No Upstox token configured. Connect via the sidebar first.")
    return t


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


# ---------------------------------------------------------------------------
# Funds / margin
# ---------------------------------------------------------------------------
@router.get("/funds")
def get_funds():
    """Return available equity margin. Requires Upstox token."""
    if not settings.upstox_access_token:
        raise HTTPException(403, "No Upstox token configured. Connect via the sidebar first.")
    import httpx
    try:
        resp = httpx.get(
            "https://api.upstox.com/v2/user/get-funds-and-margin",
            params={"segment": "SEC"},
            headers=_headers(settings.upstox_access_token),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        equity = data.get("equity", {})
        return {
            "available_margin": float(equity.get("available_margin", 0)),
            "used_margin": float(equity.get("used_margin", 0)),
            "total_balance": float(equity.get("net", 0)),
            "mock": False,
        }
    except Exception as e:
        raise HTTPException(502, f"Could not fetch funds: {e}")


# ---------------------------------------------------------------------------
# Place order
# ---------------------------------------------------------------------------
class OrderRequest(BaseModel):
    symbol: str
    action: str          # buy | sell
    order_type: str      # LIMIT | MARKET | SL | SL-M
    price: float         # limit price (0 for MARKET)
    trigger_price: float = 0  # stop-loss trigger (0 if not SL order)
    quantity: int
    product: str = "I"   # I = Intraday, D = Delivery, B = Bracket
    tag: str = "iris_edge"
    # Bracket order fields (only used when product="B")
    bracket: bool = False
    bracket_sl: float = 0.0    # absolute SL price
    bracket_target: float = 0.0  # absolute target price


@router.post("/order")
def place_order(req: OrderRequest):
    """Place an order on Upstox. Returns order_id on success."""
    if not settings.upstox_access_token:
        raise HTTPException(403, "No Upstox token configured. Connect via the sidebar first.")

    import httpx
    from app.utils.upstox_client import _instrument_key
    try:
        key = _instrument_key(req.symbol)
    except ValueError as e:
        raise HTTPException(400, str(e))

    is_bracket = req.bracket and req.bracket_sl > 0 and req.bracket_target > 0
    product = "B" if is_bracket else req.product
    entry_price = req.price if req.order_type in ("LIMIT", "SL") else 0

    payload = {
        "quantity": req.quantity,
        "product": product,
        "validity": "DAY",
        "price": entry_price,
        "tag": req.tag,
        "instrument_token": key,
        "order_type": req.order_type,
        "transaction_type": req.action.upper(),
        "disclosed_quantity": 0,
        "trigger_price": req.trigger_price if req.order_type in ("SL", "SL-M") else 0,
        "is_amo": False,
    }

    if is_bracket:
        # Upstox bracket expects price offsets from entry (positive values)
        ref = entry_price if entry_price > 0 else req.bracket_sl  # fallback for MARKET
        if req.action.lower() == "buy":
            payload["squareoff"] = round(abs(req.bracket_target - ref), 2)
            payload["stoploss"] = round(abs(ref - req.bracket_sl), 2)
        else:
            payload["squareoff"] = round(abs(ref - req.bracket_target), 2)
            payload["stoploss"] = round(abs(req.bracket_sl - ref), 2)

    try:
        resp = httpx.post(
            "https://api.upstox.com/v2/order/place",
            json=payload,
            headers={**_headers(settings.upstox_access_token), "Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {"order_id": data.get("order_id"), "status": "placed", "mock": False, "bracket": is_bracket}
    except httpx.HTTPStatusError as e:
        detail = e.response.text
        raise HTTPException(e.response.status_code, f"Upstox order error: {detail}")
    except Exception as e:
        raise HTTPException(502, f"Order placement failed: {e}")


# ---------------------------------------------------------------------------
# Open positions
# ---------------------------------------------------------------------------
@router.get("/positions")
def get_positions():
    """Return today's open intraday positions."""
    if not settings.upstox_access_token:
        raise HTTPException(403, "No Upstox token configured. Connect via the sidebar first.")

    import httpx
    try:
        resp = httpx.get(
            "https://api.upstox.com/v2/portfolio/short-term-positions",
            headers=_headers(settings.upstox_access_token),
            timeout=10,
        )
        resp.raise_for_status()
        raw = resp.json().get("data", [])

        # Load SL/target from trade cards for each symbol
        with SessionLocal() as db:
            cards = {
                row.symbol: row
                for row in db.query(TradeCardModel)
                .filter(TradeCardModel.archived == False)  # noqa: E712
                .order_by(TradeCardModel.created_at.desc())
                .all()
            }

        positions = []
        for p in raw:
            qty = int(p.get("quantity", 0))
            if qty == 0:
                continue
            buy_avg = float(p.get("buy_price", 0) or 0)
            sell_avg = float(p.get("sell_price", 0) or 0)
            ltp = float(p.get("last_price", 0) or 0)
            pnl = float(p.get("pnl", 0) or 0)
            action = "buy" if qty > 0 else "sell"
            avg_price = buy_avg if action == "buy" else sell_avg
            abs_qty = abs(qty)
            symbol = p.get("tradingsymbol", "")
            card = cards.get(symbol)
            positions.append({
                "symbol": symbol,
                "action": action,
                "quantity": abs_qty,
                "average_price": avg_price,
                "last_price": ltp,
                "stop_loss": round(card.stop_loss, 2) if card else None,
                "target": round(card.target, 2) if card else None,
                "pnl": round(pnl, 2),
                "pnl_pct": round((pnl / (avg_price * abs_qty)) * 100, 2) if avg_price and abs_qty else 0,
                "product": p.get("product", ""),
                "exchange": "NSE",
            })
        return {"positions": positions, "mock": False}
    except Exception as e:
        raise HTTPException(502, f"Could not fetch positions: {e}")


# ---------------------------------------------------------------------------
# Today's orders
# ---------------------------------------------------------------------------
@router.get("/orders")
def get_orders():
    """Return today's placed orders."""
    if not settings.upstox_access_token:
        raise HTTPException(403, "No Upstox token configured. Connect via the sidebar first.")

    import httpx
    try:
        resp = httpx.get(
            "https://api.upstox.com/v2/order/retrieve-all",
            headers=_headers(settings.upstox_access_token),
            timeout=10,
        )
        resp.raise_for_status()
        raw = resp.json().get("data", [])
        orders = [
            {
                "order_id": o.get("order_id"),
                "symbol": o.get("tradingsymbol", ""),
                "action": o.get("transaction_type", "").lower(),
                "order_type": o.get("order_type", ""),
                "quantity": int(o.get("quantity", 0)),
                "price": float(o.get("price", 0)),
                "avg_price": float(o.get("average_price", 0)),
                "status": o.get("status", "").lower(),
                "placed_at": o.get("order_timestamp", ""),
            }
            for o in raw
        ]
        return {"orders": orders, "mock": False}
    except Exception as e:
        raise HTTPException(502, f"Could not fetch orders: {e}")


# ---------------------------------------------------------------------------
# Close position (place opposing order)
# ---------------------------------------------------------------------------
class CloseRequest(BaseModel):
    symbol: str
    quantity: int
    action: str   # the CLOSING action: if position is BUY → action=sell


@router.post("/close")
def close_position(req: CloseRequest):
    """Place a market order to close an open position."""
    return place_order(OrderRequest(
        symbol=req.symbol,
        action=req.action,
        order_type="MARKET",
        price=0,
        trigger_price=0,
        quantity=req.quantity,
    ))


