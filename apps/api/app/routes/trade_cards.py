from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RiskConfigModel, TradeCardModel, WatchlistModel
from app.schemas import GenerateResponseSchema, TradeCardSchema
from app.services.card_generator import generate_cards
from app.services.card_validator import refresh_card_status
from app.utils.mock_data import get_mock_quote

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
    risk_config = db.query(RiskConfigModel).first()
    watchlist = db.query(WatchlistModel).first()

    symbols = watchlist.symbols if watchlist else []
    cards = generate_cards(symbols, risk_config, db)

    return GenerateResponseSchema(generated=len(cards), cards=cards)


@router.post("/refresh")
def refresh(db: Session = Depends(get_db)):
    _TERMINAL = {"invalidated", "completed"}
    cards = (
        db.query(TradeCardModel)
        .filter(TradeCardModel.status.notin_(_TERMINAL))
        .filter(TradeCardModel.archived == False)  # noqa: E712
        .all()
    )
    updated = 0
    for card in cards:
        quote = get_mock_quote(card.symbol)
        if refresh_card_status(card, quote):
            updated += 1
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
