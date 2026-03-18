"""
Live market data via Upstox v2.

get_live_quote(symbol) returns the same field dict as get_mock_quote()
so card_generator, signal_evaluator, and all downstream code require no changes.
"""

import numpy as np
import pandas as pd
from ta.momentum import RSIIndicator, StochRSIIndicator
from ta.trend import EMAIndicator, MACD
from ta.volatility import AverageTrueRange, BollingerBands
from ta.volume import OnBalanceVolumeIndicator

from app.utils.market_hours import is_market_open
from app.utils.upstox_client import (
    get_daily_candles,
    get_index_quote,
    get_intraday_candles,
    get_market_quote,
)

_NIFTY_KEY = "NSE_INDEX|Nifty 50"


def _nifty_direction(token: str) -> str:
    """
    Returns 'up', 'down', or 'flat' for Nifty 50 based on
    whether current price is above or below its 9-period EMA.
    Falls back to 'flat' on any error.
    """
    try:
        q = get_index_quote(_NIFTY_KEY, token)
        price = float(q["last_price"])
        candles = get_daily_candles("NIFTY_50", token, days=30)
        candles = list(reversed(candles))
        closes = pd.Series([float(c[4]) for c in candles])
        ema9 = EMAIndicator(close=closes, window=9).ema_indicator().iloc[-1]
        if price > ema9 * 1.001:
            return "up"
        elif price < ema9 * 0.999:
            return "down"
        return "flat"
    except Exception:
        return "flat"


def get_live_quote(symbol: str, token: str) -> dict:
    """
    Fetch live market data from Upstox and compute all indicators.
    Returns the same dict shape as get_mock_quote().
    """
    # ------------------------------------------------------------------ #
    # 1. Current market quote                                              #
    # ------------------------------------------------------------------ #
    q = get_market_quote(symbol, token)

    price = float(q["last_price"])
    open_ = float(q["ohlc"]["open"])
    high = float(q["ohlc"]["high"])
    low = float(q["ohlc"]["low"])
    prev_close = float(q["ohlc"]["close"])  # ohlc.close = previous session close
    volume = int(q.get("volume", 0))
    vwap = float(q.get("average_price", price))

    upper_circuit = float(q.get("upper_circuit_limit", prev_close * 1.20))
    lower_circuit = float(q.get("lower_circuit_limit", prev_close * 0.80))
    near_circuit = (price >= upper_circuit * 0.98) or (price <= lower_circuit * 1.02)

    gap_pct = round((open_ - prev_close) / prev_close, 4) if prev_close else 0.0

    # ------------------------------------------------------------------ #
    # 2. Daily candles → technical indicators                             #
    # ------------------------------------------------------------------ #
    candles = get_daily_candles(symbol, token, days=60)
    candles = list(reversed(candles))  # chronological order

    df = pd.DataFrame(
        candles, columns=["ts", "open", "high", "low", "close", "volume", "oi"]
    )
    df = df.astype(
        {"open": float, "high": float, "low": float, "close": float, "volume": float}
    )

    close = df["close"]
    vol = df["volume"]

    # RSI
    rsi_val = RSIIndicator(close=close, window=14).rsi().iloc[-1]
    rsi = round(float(rsi_val), 1) if not np.isnan(rsi_val) else 50.0

    # EMA
    def _ema(n: int) -> float:
        v = EMAIndicator(close=close, window=n).ema_indicator().iloc[-1]
        return round(float(v), 2) if not np.isnan(v) else round(price, 2)

    ema9 = _ema(9)
    ema21 = _ema(21)
    ema50 = _ema(50)

    # MACD histogram
    macd_obj = MACD(close=close)
    macd_hist_val = macd_obj.macd_diff().iloc[-1]
    macd_histogram = round(float(macd_hist_val), 4) if not np.isnan(macd_hist_val) else 0.0

    # ATR
    atr_val = AverageTrueRange(
        high=df["high"], low=df["low"], close=close, window=14
    ).average_true_range().iloc[-1]
    atr = round(float(atr_val), 2) if not np.isnan(atr_val) else round(price * 0.01, 2)

    # Bollinger Bands — bb_width as fraction of price
    bb = BollingerBands(close=close, window=20, window_dev=2)
    bb_upper_val = bb.bollinger_hband().iloc[-1]
    bb_lower_val = bb.bollinger_lband().iloc[-1]
    if not np.isnan(bb_upper_val) and not np.isnan(bb_lower_val) and price > 0:
        bb_width = round((float(bb_upper_val) - float(bb_lower_val)) / price, 4)
    else:
        bb_width = 0.03

    # StochRSI — ta library returns 0–1, scale to 0–100
    stochrsi_obj = StochRSIIndicator(close=close, window=14, smooth1=3, smooth2=3)
    stochrsi_k_val = stochrsi_obj.stochrsi_k().iloc[-1]
    stoch_rsi = round(float(stochrsi_k_val) * 100, 1) if not np.isnan(stochrsi_k_val) else 50.0

    # OBV direction — compare last 3 values
    obv_series = OnBalanceVolumeIndicator(close=close, volume=vol).on_balance_volume()
    obv_tail = obv_series.dropna().tail(3).tolist()
    if len(obv_tail) >= 2:
        obv_direction = "up" if obv_tail[-1] > obv_tail[0] else (
            "down" if obv_tail[-1] < obv_tail[0] else "flat"
        )
    else:
        obv_direction = "flat"

    # Average volume (20-day)
    avg_volume = int(df["volume"].tail(20).mean()) if len(df) >= 5 else volume
    volume_ratio = round(volume / avg_volume, 2) if avg_volume > 0 else 1.0

    # ------------------------------------------------------------------ #
    # 3. Opening range from first 15-min intraday candle                  #
    # ------------------------------------------------------------------ #
    try:
        intraday = get_intraday_candles(symbol, token, "15minute")
        if intraday:
            or_candle = intraday[0]  # first 15-min candle = 9:15–9:30
            or_high = float(or_candle[2])
            or_low = float(or_candle[3])
        else:
            raise ValueError("no intraday candles")
    except Exception:
        # Outside market hours or API error — derive from day range
        or_high = round(open_ + abs(high - low) * 0.25, 2)
        or_low = round(open_ - abs(high - low) * 0.25, 2)

    if price > or_high:
        or_breakout = "up"
    elif price < or_low:
        or_breakout = "down"
    else:
        or_breakout = "none"

    # ------------------------------------------------------------------ #
    # 4. Market context                                                    #
    # ------------------------------------------------------------------ #
    nifty_dir = _nifty_direction(token)

    return {
        # Core price
        "symbol": symbol,
        "price": round(price, 2),
        "open": round(open_, 2),
        "high": round(high, 2),
        "low": round(low, 2),
        "vwap": round(vwap, 2),
        "prev_close": round(prev_close, 2),
        # Momentum
        "rsi": rsi,
        "stoch_rsi": stoch_rsi,
        "macd_histogram": macd_histogram,
        # Volume
        "volume": volume,
        "avg_volume": avg_volume,
        "volume_ratio": volume_ratio,
        # Trend
        "ema9": ema9,
        "ema21": ema21,
        "ema50": ema50,
        "obv_direction": obv_direction,
        # Volatility
        "atr": atr,
        "bb_width": bb_width,
        # Structure
        "gap_pct": gap_pct,
        "or_high": round(or_high, 2),
        "or_low": round(or_low, 2),
        "or_breakout": or_breakout,
        # Market context
        "nifty_direction": nifty_dir,
        "sector_direction": "flat",  # TODO: fetch sector ETF trend
        # Filters
        "near_circuit": near_circuit,
        "in_time_window": is_market_open(),
    }
