"""
Paper trading routes — virtual wallet, simulated orders, and paper P&L.
Requires Upstox to be connected for live price data.
"""
import uuid
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import PaperWalletModel, PaperPositionModel, PaperOrderModel

router = APIRouter()


def _get_wallet(db: Session) -> PaperWalletModel:
    w = db.query(PaperWalletModel).filter_by(id=1).first()
    if not w:
        w = PaperWalletModel(id=1)
        db.add(w)
        db.commit()
        db.refresh(w)
    return w


def _get_ltp(symbol: str) -> float:
    """Fetch real LTP from Upstox. Raises 503 if not connected or if the call fails."""
    if not settings.upstox_access_token:
        raise HTTPException(503, "Cannot get live price — connect Upstox to use paper trading")
    try:
        from app.utils.upstox_client import get_market_quote
        q = get_market_quote(symbol, settings.upstox_access_token)
        return float(q.get("last_price", 0))
    except Exception as e:
        raise HTTPException(503, "Cannot get live price — connect Upstox to use paper trading")


# ---------------------------------------------------------------------------
# Wallet status
# ---------------------------------------------------------------------------
@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    w = _get_wallet(db)
    return {
        "enabled": w.enabled,
        "balance": round(w.balance, 2),
        "initial_balance": round(w.initial_balance, 2),
    }


class WalletConfig(BaseModel):
    enabled: bool | None = None
    add_funds: float | None = None      # add to existing balance
    set_balance: float | None = None    # replace balance entirely


@router.put("/status")
def update_status(cfg: WalletConfig, db: Session = Depends(get_db)):
    w = _get_wallet(db)
    if cfg.enabled is not None:
        w.enabled = cfg.enabled
    if cfg.set_balance is not None:
        if cfg.set_balance < 0:
            raise HTTPException(400, "Balance cannot be negative")
        w.balance = cfg.set_balance
        w.initial_balance = cfg.set_balance
    if cfg.add_funds is not None:
        if cfg.add_funds <= 0:
            raise HTTPException(400, "add_funds must be positive")
        w.balance += cfg.add_funds
        if w.initial_balance == 0:
            w.initial_balance = w.balance
    db.commit()
    db.refresh(w)
    return {"enabled": w.enabled, "balance": round(w.balance, 2), "initial_balance": round(w.initial_balance, 2)}


# ---------------------------------------------------------------------------
# Place paper order
# ---------------------------------------------------------------------------
class PaperOrderRequest(BaseModel):
    symbol: str
    action: str          # buy | sell
    order_type: str      # LIMIT | MARKET | SL | SL-M
    price: float         # limit price (0 for MARKET)
    trigger_price: float = 0
    quantity: int
    stop_loss: float = 0.0
    target: float = 0.0


@router.post("/order")
def place_paper_order(req: PaperOrderRequest, db: Session = Depends(get_db)):
    w = _get_wallet(db)
    if not w.enabled:
        raise HTTPException(400, "Paper trading is not enabled")

    # Determine fill price
    if req.order_type == "MARKET":
        executed_price = _get_ltp(req.symbol)
    else:
        executed_price = req.price if req.price > 0 else _get_ltp(req.symbol)

    cost = executed_price * req.quantity

    if req.action.lower() == "buy":
        # First check if this is closing an existing short position
        short_pos = db.query(PaperPositionModel).filter_by(symbol=req.symbol, action="sell").first()
        if short_pos:
            # Closing a short — buy back at market, deduct cost
            if w.balance < cost:
                raise HTTPException(400, f"Insufficient paper balance. Need ₹{cost:.2f}, have ₹{w.balance:.2f}")
            w.balance -= cost
            short_pos.quantity -= req.quantity
            if short_pos.quantity <= 0:
                db.delete(short_pos)
        else:
            # Regular long buy
            if w.balance < cost:
                raise HTTPException(400, f"Insufficient paper balance. Need ₹{cost:.2f}, have ₹{w.balance:.2f}")
            w.balance -= cost
            pos = db.query(PaperPositionModel).filter_by(symbol=req.symbol, action="buy").first()
            if pos:
                total_qty = pos.quantity + req.quantity
                pos.avg_price = (pos.avg_price * pos.quantity + executed_price * req.quantity) / total_qty
                pos.quantity = total_qty
                if req.stop_loss: pos.stop_loss = req.stop_loss
                if req.target: pos.target = req.target
            else:
                pos = PaperPositionModel(
                    id=str(uuid.uuid4()),
                    symbol=req.symbol,
                    action="buy",
                    quantity=req.quantity,
                    avg_price=executed_price,
                    stop_loss=req.stop_loss,
                    target=req.target,
                )
                db.add(pos)

    else:  # sell
        # First check if this is closing an existing long position
        long_pos = db.query(PaperPositionModel).filter_by(symbol=req.symbol, action="buy").first()
        if long_pos:
            # Closing a long — sell at market, credit proceeds
            proceeds = executed_price * req.quantity
            w.balance += proceeds
            long_pos.quantity -= req.quantity
            if long_pos.quantity <= 0:
                db.delete(long_pos)
        else:
            # Opening a short position
            proceeds = executed_price * req.quantity
            w.balance += proceeds
            short_pos = db.query(PaperPositionModel).filter_by(symbol=req.symbol, action="sell").first()
            if short_pos:
                total_qty = short_pos.quantity + req.quantity
                short_pos.avg_price = (short_pos.avg_price * short_pos.quantity + executed_price * req.quantity) / total_qty
                short_pos.quantity = total_qty
                if req.stop_loss: short_pos.stop_loss = req.stop_loss
                if req.target: short_pos.target = req.target
            else:
                short_pos = PaperPositionModel(
                    id=str(uuid.uuid4()),
                    symbol=req.symbol,
                    action="sell",
                    quantity=req.quantity,
                    avg_price=executed_price,
                    stop_loss=req.stop_loss,
                    target=req.target,
                )
                db.add(short_pos)

    # Record order
    order = PaperOrderModel(
        id=str(uuid.uuid4()),
        symbol=req.symbol,
        action=req.action.lower(),
        order_type=req.order_type,
        quantity=req.quantity,
        price=req.price,
        executed_price=executed_price,
        status="complete",
    )
    db.add(order)
    db.commit()

    return {
        "order_id": f"PAPER-{order.id[:8].upper()}",
        "executed_price": round(executed_price, 2),
        "status": "complete",
        "paper": True,
        "balance_after": round(w.balance, 2),
    }


# ---------------------------------------------------------------------------
# Positions with live P&L
# ---------------------------------------------------------------------------
@router.get("/positions")
def get_paper_positions(db: Session = Depends(get_db)):
    rows = db.query(PaperPositionModel).all()
    out = []
    for p in rows:
        ltp = _get_ltp(p.symbol)

        # Auto-exit if bracket SL or target hit
        if p.stop_loss or p.target:
            sl_hit = p.stop_loss and (
                (p.action == "buy" and ltp <= p.stop_loss) or
                (p.action == "sell" and ltp >= p.stop_loss)
            )
            target_hit = p.target and (
                (p.action == "buy" and ltp >= p.target) or
                (p.action == "sell" and ltp <= p.target)
            )
            if sl_hit or target_hit:
                exit_price = p.stop_loss if sl_hit else p.target
                w = _get_wallet(db)
                if p.action == "buy":
                    w.balance += exit_price * p.quantity
                else:
                    w.balance -= exit_price * p.quantity
                label = "SL" if sl_hit else "Target"
                order = PaperOrderModel(
                    id=str(uuid.uuid4()),
                    symbol=p.symbol,
                    action="sell" if p.action == "buy" else "buy",
                    order_type=f"BRACKET-{label}",
                    quantity=p.quantity,
                    price=exit_price,
                    executed_price=exit_price,
                    status="complete",
                )
                db.add(order)
                db.delete(p)
                db.commit()
                continue  # skip adding to out — position is closed

        if p.action == "buy":
            pnl = (ltp - p.avg_price) * p.quantity
        else:
            pnl = (p.avg_price - ltp) * p.quantity
        invested = p.avg_price * p.quantity
        out.append({
            "symbol": p.symbol,
            "action": p.action,
            "quantity": p.quantity,
            "average_price": round(p.avg_price, 2),
            "last_price": round(ltp, 2),
            "stop_loss": round(p.stop_loss, 2) if p.stop_loss else None,
            "target": round(p.target, 2) if p.target else None,
            "pnl": round(pnl, 2),
            "pnl_pct": round((pnl / invested) * 100, 2) if invested else 0,
            "product": "PAPER",
            "exchange": "NSE",
            "paper": True,
        })
    return {"positions": out, "mock": False, "paper": True}


# ---------------------------------------------------------------------------
# Orders history
# ---------------------------------------------------------------------------
@router.get("/orders")
def get_paper_orders(db: Session = Depends(get_db)):
    rows = db.query(PaperOrderModel).order_by(PaperOrderModel.created_at.desc()).limit(50).all()
    return {
        "orders": [
            {
                "order_id": f"PAPER-{r.id[:8].upper()}",
                "symbol": r.symbol,
                "action": r.action,
                "order_type": r.order_type,
                "quantity": r.quantity,
                "price": r.price,
                "avg_price": r.executed_price,
                "status": r.status,
                "placed_at": r.created_at.strftime("%H:%M:%S"),
                "paper": True,
            }
            for r in rows
        ],
        "paper": True,
    }


# ---------------------------------------------------------------------------
# Close paper position
# ---------------------------------------------------------------------------
class PaperCloseRequest(BaseModel):
    symbol: str
    quantity: int
    action: str  # the CLOSING action: sell to close a buy, buy to close a sell


@router.post("/close")
def close_paper_position(req: PaperCloseRequest, db: Session = Depends(get_db)):
    return place_paper_order(
        PaperOrderRequest(
            symbol=req.symbol,
            action=req.action,
            order_type="MARKET",
            price=0,
            quantity=req.quantity,
        ),
        db=db,
    )
