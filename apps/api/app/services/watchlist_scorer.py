"""
Auto-watchlist scoring engine.
Evaluates each stock in the universe against technical and volume criteria,
ranks them, and persists today's watchlist to the DB.
"""
from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.config import settings
from app.models import DailyWatchlistModel

# ---------------------------------------------------------------------------
# Configurable weights (can be externalised to RiskConfig later)
# ---------------------------------------------------------------------------
WEIGHTS: dict[str, int] = {
    "gap_up": 15,
    "gap_down": 10,
    "volume_spike": 20,
    "high_volume": 12,
    "rsi_bullish": 10,
    "rsi_reversal": 8,
    "bullish_ema_stack": 10,
    "bearish_ema_stack": 8,
    "macd_positive": 5,
    "strong_sector": 10,
    "weak_sector": -5,
    "high_atr": 10,
    "or_breakout_up": 15,
    "or_breakout_down": 8,
    "nifty_aligned": 5,
    "low_liquidity": -25,
    "near_circuit": -10,
}

TOP_N = 30  # max entries stored per day


# ---------------------------------------------------------------------------
# Quote helper
# ---------------------------------------------------------------------------
def _get_quote(symbol: str) -> dict:
    if not settings.upstox_access_token:
        raise RuntimeError("No Upstox token configured. Connect via the sidebar first.")
    from app.utils.market_data import get_live_quote
    return get_live_quote(symbol, settings.upstox_access_token)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def _score(quote: dict) -> tuple[int, list[str], str, str]:
    """Return (score, reason_tags, category, action)."""
    score = 0
    tags: list[str] = []

    price = quote.get("price", 1) or 1
    gap_pct = (quote.get("gap_pct") or 0) * 100
    vol_ratio = quote.get("volume_ratio") or 1.0
    rsi = quote.get("rsi") or 50
    ema21 = quote.get("ema21") or price
    ema50 = quote.get("ema50") or price
    macd = quote.get("macd_histogram") or 0
    sector = quote.get("sector_direction") or "flat"
    atr = quote.get("atr") or 0
    or_breakout = quote.get("or_breakout") or "none"
    nifty = quote.get("nifty_direction") or "flat"
    volume = quote.get("volume") or 0

    # Gap
    if gap_pct > 1.5:
        score += WEIGHTS["gap_up"];       tags.append("Gap Up")
    elif gap_pct < -1.5:
        score += WEIGHTS["gap_down"];     tags.append("Gap Down")

    # Volume
    if vol_ratio > 2.0:
        score += WEIGHTS["volume_spike"]; tags.append("Volume Spike")
    elif vol_ratio > 1.5:
        score += WEIGHTS["high_volume"];  tags.append("High Volume")

    # RSI
    if 55 <= rsi <= 73:
        score += WEIGHTS["rsi_bullish"];  tags.append("RSI Bullish")
    elif 27 <= rsi <= 45:
        score += WEIGHTS["rsi_reversal"]; tags.append("RSI Reversal Zone")

    # EMA trend
    if price > ema21 > ema50:
        score += WEIGHTS["bullish_ema_stack"]; tags.append("Bullish EMA Stack")
    elif price < ema21 < ema50:
        score += WEIGHTS["bearish_ema_stack"]; tags.append("Bearish EMA Stack")

    # MACD
    if macd > 0:
        score += WEIGHTS["macd_positive"]; tags.append("MACD Positive")

    # Sector
    if sector == "up":
        score += WEIGHTS["strong_sector"]; tags.append("Strong Sector")
    elif sector == "down":
        score += WEIGHTS["weak_sector"]

    # ATR
    atr_pct = atr / price * 100 if price else 0
    if atr_pct > 1.5:
        score += WEIGHTS["high_atr"];  tags.append("High ATR")

    # Opening range
    if or_breakout == "up":
        score += WEIGHTS["or_breakout_up"];   tags.append("OR Breakout ↑")
    elif or_breakout == "down":
        score += WEIGHTS["or_breakout_down"]; tags.append("OR Breakdown ↓")

    # Nifty alignment
    if (nifty == "up" and price > ema21) or (nifty == "down" and price < ema21):
        score += WEIGHTS["nifty_aligned"]; tags.append("Nifty Aligned")

    # Penalties
    if volume < 100_000:
        score += WEIGHTS["low_liquidity"]; tags.append("Low Liquidity")
    if quote.get("near_circuit"):
        score += WEIGHTS["near_circuit"];  tags.append("Near Circuit Limit")

    score = max(0, score)

    # Bias → action
    bull = {"Gap Up", "RSI Bullish", "Bullish EMA Stack", "OR Breakout ↑", "MACD Positive"}
    bear = {"Gap Down", "RSI Reversal Zone", "Bearish EMA Stack", "OR Breakdown ↓"}
    tag_set = set(tags)
    action = "buy" if len(tag_set & bull) >= len(tag_set & bear) else "sell"

    # Category
    category = _categorize(tag_set, gap_pct)

    return score, tags, category, action


def _categorize(tag_set: set[str], gap_pct: float) -> str:
    if "Gap Up" in tag_set and tag_set & {"Volume Spike", "High Volume"}:
        return "Gap Up Momentum"
    if "Gap Down" in tag_set and tag_set & {"RSI Reversal Zone", "High Volume", "Volume Spike"}:
        return "Gap Down Reversal"
    if "OR Breakout ↑" in tag_set or ("Bullish EMA Stack" in tag_set and tag_set & {"Volume Spike", "High Volume"}):
        return "Breakout Candidate"
    if tag_set & {"Volume Spike", "High Volume"}:
        return "High Volume Mover"
    return "Strong Momentum"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def generate_auto_watchlist(db: Session, universe: list[str] | None = None) -> list[DailyWatchlistModel]:
    """
    Score all symbols, rank, persist.  Replaces today's existing entries.
    Returns the saved entries ordered by rank.
    """
    from app.routes.market import COMMON_STOCKS

    today = date.today().isoformat()
    symbols = universe or [s["symbol"] for s in COMMON_STOCKS]

    # Wipe today's stale entries
    db.query(DailyWatchlistModel).filter(DailyWatchlistModel.date == today).delete()
    db.commit()

    scored: list[tuple[int, str, list[str], str, str, dict]] = []
    for symbol in symbols:
        try:
            quote = _get_quote(symbol)
            sc, tags, category, action = _score(quote)
            if sc == 0:
                continue
            snapshot = {
                k: quote.get(k)
                for k in [
                    "price", "rsi", "volume_ratio", "gap_pct",
                    "ema21", "ema50", "macd_histogram", "atr",
                    "sector_direction", "or_breakout", "nifty_direction",
                ]
            }
            scored.append((sc, symbol, tags, category, action, snapshot))
        except Exception:
            continue

    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[:TOP_N]

    entries: list[DailyWatchlistModel] = []
    for rank, (sc, symbol, tags, category, action, snapshot) in enumerate(scored, start=1):
        entry = DailyWatchlistModel(
            id=str(uuid4()),
            date=today,
            symbol=symbol,
            score=sc,
            rank=rank,
            category=category,
            action=action,
            reason_tags=tags,
            indicator_snapshot=snapshot,
        )
        db.add(entry)
        entries.append(entry)

    db.commit()
    return entries
