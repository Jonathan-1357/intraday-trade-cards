"""
Auto-generated daily watchlist endpoints.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyWatchlistModel
from app.schemas import DailyWatchlistEntrySchema
from app.services.watchlist_scorer import generate_auto_watchlist

router = APIRouter()


@router.post("/generate")
def generate(db: Session = Depends(get_db)):
    """Run the scoring pipeline and persist today's watchlist."""
    entries = generate_auto_watchlist(db)
    return {
        "generated": len(entries),
        "date": date.today().isoformat(),
        "entries": [DailyWatchlistEntrySchema.model_validate(e) for e in entries],
    }


@router.get("/today")
def get_today(db: Session = Depends(get_db)):
    """Return today's auto-generated watchlist grouped by category."""
    today = date.today().isoformat()
    entries = (
        db.query(DailyWatchlistModel)
        .filter(
            DailyWatchlistModel.date == today,
            DailyWatchlistModel.dismissed == False,  # noqa: E712
        )
        .order_by(DailyWatchlistModel.rank)
        .all()
    )

    grouped: dict[str, list] = {}
    for e in entries:
        grouped.setdefault(e.category, []).append(
            DailyWatchlistEntrySchema.model_validate(e)
        )

    return {
        "date": today,
        "total": len(entries),
        "categories": grouped,
    }


@router.post("/{entry_id}/dismiss")
def dismiss(entry_id: str, db: Session = Depends(get_db)):
    entry = db.get(DailyWatchlistModel, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    entry.dismissed = True
    db.commit()
    return {"ok": True}


@router.post("/{entry_id}/traded")
def mark_traded(entry_id: str, db: Session = Depends(get_db)):
    entry = db.get(DailyWatchlistModel, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    entry.traded = True
    db.commit()
    return {"ok": True}
