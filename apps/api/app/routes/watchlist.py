from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WatchlistModel
from app.schemas import WatchlistSchema

router = APIRouter()


@router.get("/", response_model=WatchlistSchema)
def get_watchlist(db: Session = Depends(get_db)):
    watchlist = db.query(WatchlistModel).first()
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return watchlist


@router.put("/", response_model=WatchlistSchema)
def update_watchlist(body: WatchlistSchema, db: Session = Depends(get_db)):
    watchlist = db.query(WatchlistModel).first()
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    watchlist.symbols = body.symbols
    db.commit()
    db.refresh(watchlist)
    return watchlist
