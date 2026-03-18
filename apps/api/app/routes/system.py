"""
System / connection config endpoints.
Allows the frontend to read and update the Upstox access token at runtime
without restarting the server.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import ApiConfigModel

router = APIRouter()


def _get_or_create(db: Session) -> ApiConfigModel:
    row = db.get(ApiConfigModel, 1)
    if not row:
        row = ApiConfigModel(id=1, upstox_token="")
        db.add(row)
        db.commit()
    return row


def load_token_from_db(db: Session) -> None:
    """Called at startup — seeds settings from DB if a token was previously saved."""
    row = db.get(ApiConfigModel, 1)
    if row and row.upstox_token:
        settings.upstox_access_token = row.upstox_token


@router.get("/connection")
def get_connection(db: Session = Depends(get_db)):
    """Return current connection status."""
    row = _get_or_create(db)
    token = row.upstox_token or settings.upstox_access_token
    connected = bool(token)

    # Lightweight live check — try fetching a known index quote
    live_ok = False
    if connected:
        try:
            import httpx
            resp = httpx.get(
                "https://api.upstox.com/v2/market-quote/quotes",
                params={"instrument_key": "NSE_INDEX|Nifty 50"},
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                timeout=5,
            )
            live_ok = resp.status_code == 200
        except Exception:
            live_ok = False

    return {
        "connected": connected and live_ok,
        "has_token": connected,
        "token_preview": f"{token[:12]}…" if connected else None,
    }


class TokenPayload(BaseModel):
    token: str


@router.put("/connection")
def save_connection(payload: TokenPayload, db: Session = Depends(get_db)):
    """Save (or clear) the Upstox access token."""
    token = payload.token.strip()
    row = _get_or_create(db)
    row.upstox_token = token
    db.commit()
    # Update in-memory settings so the change takes effect immediately
    settings.upstox_access_token = token
    return {"ok": True, "has_token": bool(token)}
