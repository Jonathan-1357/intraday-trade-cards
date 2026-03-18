"""
Market data endpoints: search, quote, candles.
Requires a valid Upstox token for quote and candle data.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter()

COMMON_STOCKS = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd"},
    {"symbol": "INFY", "name": "Infosys Ltd"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd"},
    {"symbol": "ITC", "name": "ITC Ltd"},
    {"symbol": "SBIN", "name": "State Bank of India"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd"},
    {"symbol": "WIPRO", "name": "Wipro Ltd"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Ltd"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Ltd"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd"},
    {"symbol": "TITAN", "name": "Titan Company Ltd"},
    {"symbol": "ULTRACEMCO", "name": "UltraTech Cement Ltd"},
    {"symbol": "ONGC", "name": "Oil & Natural Gas Corp Ltd"},
    {"symbol": "NTPC", "name": "NTPC Ltd"},
    {"symbol": "POWERGRID", "name": "Power Grid Corporation Ltd"},
    {"symbol": "TECHM", "name": "Tech Mahindra Ltd"},
    {"symbol": "HCLTECH", "name": "HCL Technologies Ltd"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Ltd"},
    {"symbol": "ADANIPORTS", "name": "Adani Ports & SEZ Ltd"},
    {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv Ltd"},
    {"symbol": "JSWSTEEL", "name": "JSW Steel Ltd"},
    {"symbol": "TATASTEEL", "name": "Tata Steel Ltd"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd"},
    {"symbol": "M&M", "name": "Mahindra & Mahindra Ltd"},
    {"symbol": "CIPLA", "name": "Cipla Ltd"},
    {"symbol": "DRREDDY", "name": "Dr Reddys Laboratories Ltd"},
    {"symbol": "DIVISLAB", "name": "Divi's Laboratories Ltd"},
    {"symbol": "APOLLOHOSP", "name": "Apollo Hospitals Enterprise Ltd"},
    {"symbol": "EICHERMOT", "name": "Eicher Motors Ltd"},
    {"symbol": "HEROMOTOCO", "name": "Hero MotoCorp Ltd"},
    {"symbol": "BAJAJ-AUTO", "name": "Bajaj Auto Ltd"},
    {"symbol": "GRASIM", "name": "Grasim Industries Ltd"},
    {"symbol": "COALINDIA", "name": "Coal India Ltd"},
    {"symbol": "BPCL", "name": "Bharat Petroleum Corp Ltd"},
    {"symbol": "IOC", "name": "Indian Oil Corporation Ltd"},
    {"symbol": "INDUSINDBK", "name": "IndusInd Bank Ltd"},
    {"symbol": "NESTLEIND", "name": "Nestle India Ltd"},
    {"symbol": "BRITANNIA", "name": "Britannia Industries Ltd"},
    {"symbol": "TATACONSUM", "name": "Tata Consumer Products Ltd"},
    {"symbol": "UPL", "name": "UPL Ltd"},
    {"symbol": "SHREECEM", "name": "Shree Cement Ltd"},
    {"symbol": "PIDILITIND", "name": "Pidilite Industries Ltd"},
    {"symbol": "HAVELLS", "name": "Havells India Ltd"},
    {"symbol": "VOLTAS", "name": "Voltas Ltd"},
    {"symbol": "MUTHOOTFIN", "name": "Muthoot Finance Ltd"},
    {"symbol": "BANDHANBNK", "name": "Bandhan Bank Ltd"},
    {"symbol": "FEDERALBNK", "name": "Federal Bank Ltd"},
    {"symbol": "IDFCFIRSTB", "name": "IDFC First Bank Ltd"},
    {"symbol": "PNB", "name": "Punjab National Bank"},
    {"symbol": "BANKBARODA", "name": "Bank of Baroda"},
    {"symbol": "CANBK", "name": "Canara Bank"},
    {"symbol": "SAIL", "name": "Steel Authority of India Ltd"},
    {"symbol": "HINDALCO", "name": "Hindalco Industries Ltd"},
    {"symbol": "VEDL", "name": "Vedanta Ltd"},
    {"symbol": "NMDC", "name": "NMDC Ltd"},
    {"symbol": "DLF", "name": "DLF Ltd"},
    {"symbol": "GODREJPROP", "name": "Godrej Properties Ltd"},
    {"symbol": "OBEROIRLTY", "name": "Oberoi Realty Ltd"},
    {"symbol": "PAGEIND", "name": "Page Industries Ltd"},
    {"symbol": "MCDOWELL-N", "name": "United Spirits Ltd"},
    {"symbol": "VBL", "name": "Varun Beverages Ltd"},
    {"symbol": "ZOMATO", "name": "Zomato Ltd"},
    {"symbol": "NYKAA", "name": "FSN E-Commerce Ventures Ltd"},
    {"symbol": "PAYTM", "name": "One 97 Communications Ltd"},
    {"symbol": "IRCTC", "name": "Indian Railway Catering & Tourism Corp"},
    {"symbol": "HAL", "name": "Hindustan Aeronautics Ltd"},
    {"symbol": "BEL", "name": "Bharat Electronics Ltd"},
    {"symbol": "BHEL", "name": "Bharat Heavy Electricals Ltd"},
    {"symbol": "SIEMENS", "name": "Siemens Ltd"},
    {"symbol": "ABB", "name": "ABB India Ltd"},
    {"symbol": "MPHASIS", "name": "Mphasis Ltd"},
    {"symbol": "LTIM", "name": "LTIMindtree Ltd"},
    {"symbol": "PERSISTENT", "name": "Persistent Systems Ltd"},
    {"symbol": "COFORGE", "name": "Coforge Ltd"},
]

# Build a lookup dict for fast name resolution
_COMMON_STOCKS_MAP: dict[str, str] = {s["symbol"]: s["name"] for s in COMMON_STOCKS}


@router.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    """Search NSE instruments by symbol or company name."""
    if settings.upstox_access_token:
        from app.utils.upstox_client import search_instruments
        return search_instruments(q, limit)

    # Fallback: search COMMON_STOCKS
    q_lower = q.lower()
    results = [
        s for s in COMMON_STOCKS
        if q_lower in s["symbol"].lower() or q_lower in s["name"].lower()
    ]
    results.sort(key=lambda x: (
        0 if x["symbol"].lower() == q_lower else
        1 if x["symbol"].lower().startswith(q_lower) else
        2 if q_lower in x["symbol"].lower() else 3
    ))
    return results[:limit]


@router.get("/quote/{symbol}")
def get_quote_endpoint(symbol: str):
    """Return live quote for a single symbol. Requires Upstox token."""
    if not settings.upstox_access_token:
        raise HTTPException(503, "No live data — connect Upstox first")
    try:
        from app.utils.upstox_client import get_market_quote, _instrument_names
        raw = get_market_quote(symbol, settings.upstox_access_token)
        ohlc = raw.get("ohlc", {})
        ltp = raw.get("last_price", 0)
        prev_close = ohlc.get("close", ltp)
        change = round(ltp - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0
        name = _instrument_names.get(symbol, symbol)
        return {
            "symbol": symbol,
            "name": name,
            "price": ltp,
            "prev_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "open": ohlc.get("open", 0),
            "high": ohlc.get("high", 0),
            "low": ohlc.get("low", 0),
            "volume": raw.get("volume", 0),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"Could not fetch quote: {exc}")


_IST_OFFSET = 5 * 3600 + 30 * 60  # 19800 seconds


def _ts(iso_str: str) -> int:
    """Convert an ISO timestamp string to IST-adjusted Unix seconds.
    Adds IST offset so lightweight-charts (which displays UTC) shows IST times."""
    return int(datetime.fromisoformat(iso_str).timestamp()) + _IST_OFFSET


def _aggregate_candles(candles: list[dict], factor: int) -> list[dict]:
    """Aggregate N consecutive 1-min (or base-interval) candles into larger bars."""
    result = []
    for i in range(0, len(candles), factor):
        chunk = candles[i:i + factor]
        if not chunk:
            continue
        result.append({
            "time": chunk[0]["time"],
            "open": chunk[0]["open"],
            "high": max(c["high"] for c in chunk),
            "low": min(c["low"] for c in chunk),
            "close": chunk[-1]["close"],
        })
    return result


@router.get("/candles/{symbol}")
def get_candles(
    symbol: str,
    interval: str = Query("day"),
    days: int = Query(90, ge=1, le=365),
    last_n: int = Query(None),
):
    """
    Return OHLCV candles. All timestamps are Unix seconds.
    Supported intervals: day | 1minute | 15minute | 30minute | 60minute | 120minute
    Requires Upstox token.
    """
    if not settings.upstox_access_token:
        raise HTTPException(503, "No live data — connect Upstox first")

    from app.utils.upstox_client import (
        get_daily_candles, get_intraday_candles, get_historical_candles
    )

    if interval == "day":
        raw = list(reversed(get_daily_candles(symbol, settings.upstox_access_token, days)))
        candles = [
            {"time": _ts(c[0]), "open": float(c[1]), "high": float(c[2]),
             "low": float(c[3]), "close": float(c[4])}
            for c in raw
        ]
        return candles[-last_n:] if last_n else candles

    # 120minute: aggregate 30min historical into 4-bar groups
    if interval == "120minute":
        raw = list(reversed(get_historical_candles(symbol, settings.upstox_access_token, "30minute", days)))
        base = [
            {"time": _ts(c[0]), "open": float(c[1]), "high": float(c[2]),
             "low": float(c[3]), "close": float(c[4])}
            for c in raw
        ]
        return _aggregate_candles(base, 4)

    # 60minute: aggregate 30min historical into pairs
    if interval == "60minute":
        raw = list(reversed(get_historical_candles(symbol, settings.upstox_access_token, "30minute", days)))
        base = [
            {"time": _ts(c[0]), "open": float(c[1]), "high": float(c[2]),
             "low": float(c[3]), "close": float(c[4])}
            for c in raw
        ]
        return _aggregate_candles(base, 2)

    # 15minute: aggregate 1min historical into 15-bar groups
    if interval == "15minute":
        raw = list(reversed(get_historical_candles(symbol, settings.upstox_access_token, "1minute", days)))
        base = [
            {"time": _ts(c[0]), "open": float(c[1]), "high": float(c[2]),
             "low": float(c[3]), "close": float(c[4])}
            for c in raw
        ]
        return _aggregate_candles(base, 15)

    # 1minute, 30minute (multi-day): use historical candles endpoint directly
    raw = list(reversed(get_historical_candles(symbol, settings.upstox_access_token, interval, days)))
    result = [
        {"time": _ts(c[0]), "open": float(c[1]), "high": float(c[2]),
         "low": float(c[3]), "close": float(c[4])}
        for c in raw
    ]
    return result[-last_n:] if last_n else result
