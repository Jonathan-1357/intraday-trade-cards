from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RiskConfigModel, TradeCardModel, WatchlistModel
from app.schemas import GenerateResponseSchema, TradeCardSchema
from app.services.card_generator import generate_cards
from app.services.card_validator import refresh_card_status
from app.utils.market_hours import is_market_open

router = APIRouter()


@router.get("/", response_model=list[TradeCardSchema])
def list_trade_cards(
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(TradeCardModel).filter(TradeCardModel.archived == False)  # noqa: E712
    if status:
        query = query.filter(TradeCardModel.status == status)
    return query.order_by(TradeCardModel.created_at.desc()).limit(limit).all()


@router.get("/{card_id}", response_model=TradeCardSchema)
def get_trade_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(TradeCardModel).filter(TradeCardModel.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Trade card not found")
    return card


@router.post("/generate", response_model=GenerateResponseSchema)
def generate(db: Session = Depends(get_db)):
    market_open = is_market_open() or not settings.upstox_access_token

    risk_config = db.query(RiskConfigModel).first()
    watchlist = db.query(WatchlistModel).first()
    symbols = watchlist.symbols if watchlist else []
    cards = generate_cards(symbols, risk_config, db)

    return GenerateResponseSchema(
        generated=len(cards),
        cards=cards,
        market_open=market_open,
    )


@router.post("/preopen", response_model=GenerateResponseSchema)
def generate_preopen(db: Session = Depends(get_db)):
    """Generate pre-opening BUY suggestions using yesterday's data."""
    risk_config = db.query(RiskConfigModel).first()
    watchlist = db.query(WatchlistModel).first()
    symbols = watchlist.symbols if watchlist else []
    cards = generate_cards(symbols, risk_config, db, preopen=True)

    return GenerateResponseSchema(
        generated=len(cards),
        cards=cards,
        market_open=False,
    )


@router.post("/refresh")
def refresh(db: Session = Depends(get_db)):
    if not settings.upstox_access_token:
        raise HTTPException(503, "No live data — connect Upstox first")
    _TERMINAL = {"invalidated", "completed"}
    cards = (
        db.query(TradeCardModel)
        .filter(TradeCardModel.status.notin_(_TERMINAL))
        .filter(TradeCardModel.archived == False)  # noqa: E712
        .all()
    )
    from app.utils.market_data import get_live_quote
    updated = 0
    for card in cards:
        try:
            quote = get_live_quote(card.symbol, settings.upstox_access_token)
            if refresh_card_status(card, quote):
                updated += 1
        except Exception:
            continue
    db.commit()
    return {"updated": updated}


class ArchiveRequest(BaseModel):
    ids: list[str]


@router.post("/archive")
def archive_cards(body: ArchiveRequest, db: Session = Depends(get_db)):
    if not body.ids:
        return {"archived": 0}
    updated = (
        db.query(TradeCardModel)
        .filter(TradeCardModel.id.in_(body.ids))
        .update({"archived": True}, synchronize_session="fetch")
    )
    db.commit()
    return {"archived": updated}
