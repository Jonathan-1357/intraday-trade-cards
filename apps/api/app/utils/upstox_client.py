"""
Upstox v2 API client.
Fetches market quotes, daily historical candles, and intraday candles.
"""

import gzip
import json
import logging
from datetime import date, timedelta

import httpx

BASE_URL = "https://api.upstox.com/v2"
_INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz"

# symbol → instrument_key cache (populated on first use)
_symbol_map: dict[str, str] = {}
# trading_symbol → company name cache
_instrument_names: dict[str, str] = {}

logger = logging.getLogger(__name__)


def _load_symbol_map() -> None:
    """Download NSE instruments list and build symbol → instrument_key map."""
    global _symbol_map, _instrument_names
    if _symbol_map:
        return
    resp = httpx.get(_INSTRUMENTS_URL, timeout=30)
    resp.raise_for_status()
    data = json.loads(gzip.decompress(resp.content))
    _symbol_map = {
        item["trading_symbol"]: item["instrument_key"]
        for item in data
        if item.get("segment") == "NSE_EQ" and item.get("trading_symbol")
    }
    _instrument_names = {
        item["trading_symbol"]: item.get("name", item["trading_symbol"])
        for item in data
        if item.get("segment") == "NSE_EQ" and item.get("trading_symbol")
    }
    logger.info("Loaded %d NSE instruments", len(_symbol_map))


def _instrument_key(symbol: str) -> str:
    """Resolve NSE trading symbol to Upstox instrument key (e.g. NSE_EQ|INE002A01018)."""
    _load_symbol_map()
    key = _symbol_map.get(symbol)
    if not key:
        raise ValueError(f"Unknown symbol '{symbol}' — not found in NSE instruments list")
    return key


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


def get_market_quote(symbol: str, token: str) -> dict:
    """
    Returns the full live market quote dict for a single symbol.
    Response data key uses colon separator: 'NSE_EQ:ISIN'
    """
    key = _instrument_key(symbol)
    resp = httpx.get(
        f"{BASE_URL}/market-quote/quotes",
        params={"instrument_key": key},
        headers=_headers(token),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    if not data:
        raise ValueError(f"No market data for {symbol} — market may be closed")
    return next(iter(data.values()))


def get_daily_candles(symbol: str, token: str, days: int = 60) -> list:
    """
    Returns daily OHLCV candles for the last `days` calendar days.
    Each candle: [timestamp, open, high, low, close, volume, oi]
    Returned newest-first by Upstox — caller should reverse if needed.
    """
    key = _instrument_key(symbol)
    to_date = date.today().isoformat()
    from_date = (date.today() - timedelta(days=days)).isoformat()
    resp = httpx.get(
        f"{BASE_URL}/historical-candle/{key}/day/{to_date}/{from_date}",
        headers=_headers(token),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["data"]["candles"]


def get_intraday_candles(symbol: str, token: str, interval: str = "15minute") -> list:
    """
    Returns today's intraday candles.
    Each candle: [timestamp, open, high, low, close, volume, oi]
    Returned oldest-first.
    """
    key = _instrument_key(symbol)
    resp = httpx.get(
        f"{BASE_URL}/historical-candle/intraday/{key}/{interval}",
        headers=_headers(token),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["data"]["candles"]


def get_historical_candles(symbol: str, token: str, interval: str, days: int) -> list:
    """
    Returns multi-day historical candles at intraday granularity.
    interval: '1minute' | '15minute' | '30minute' | '60minute'
    Each candle: [timestamp, open, high, low, close, volume, oi]
    Returned newest-first by Upstox — caller should reverse if needed.
    """
    key = _instrument_key(symbol)
    to_date = date.today().isoformat()
    from_date = (date.today() - timedelta(days=days)).isoformat()
    resp = httpx.get(
        f"{BASE_URL}/historical-candle/{key}/{interval}/{to_date}/{from_date}",
        headers=_headers(token),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["data"]["candles"]


def search_instruments(q: str, limit: int = 20) -> list[dict]:
    """Search NSE instruments by symbol or company name."""
    _load_symbol_map()
    q_lower = q.lower()
    results = []
    for sym, name in _instrument_names.items():
        if q_lower in sym.lower() or q_lower in name.lower():
            results.append({"symbol": sym, "name": name})
    # Rank: exact symbol match first, then starts-with, then contains
    results.sort(key=lambda x: (
        0 if x["symbol"].lower() == q_lower else
        1 if x["symbol"].lower().startswith(q_lower) else
        2 if q_lower in x["symbol"].lower() else 3
    ))
    return results[:limit]


def get_index_quote(index_key: str, token: str) -> dict:
    """
    Returns the live quote for an index instrument key.
    e.g. index_key = 'NSE_INDEX|Nifty 50'
    """
    resp = httpx.get(
        f"{BASE_URL}/market-quote/quotes",
        params={"instrument_key": index_key},
        headers=_headers(token),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    if not data:
        raise ValueError("No index data returned")
    return next(iter(data.values()))
