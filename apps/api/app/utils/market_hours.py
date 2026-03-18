"""
NSE market hours utility.
Used by both the signal evaluator and API routes.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

_IST = ZoneInfo("Asia/Kolkata")


def is_market_open() -> bool:
    """True between 9:15 AM and 3:30 PM IST on weekdays."""
    now = datetime.now(_IST)
    if now.weekday() >= 5:
        return False
    open_time = now.replace(hour=9, minute=15, second=0, microsecond=0)
    close_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return open_time <= now <= close_time


def is_preopen_session() -> bool:
    """True between 9:00 AM and 9:15 AM IST on weekdays (pre-opening auction)."""
    now = datetime.now(_IST)
    if now.weekday() >= 5:
        return False
    start = now.replace(hour=9, minute=0, second=0, microsecond=0)
    end = now.replace(hour=9, minute=15, second=0, microsecond=0)
    return start <= now < end
