import random

# Module-level market direction — same for all symbols in a process run.
# Seeded by a fixed symbol so it follows the same convention as per-symbol seeds.
_nifty_rng = random.Random(hash("NIFTY50") & 0xFFFFFFFF)
_NIFTY_DIRECTION: str = _nifty_rng.choice(["up", "down", "flat"])


def get_mock_quote(symbol: str) -> dict:
    """
    Deterministic mock price data seeded by hash(symbol).
    Same symbol always returns the same quote within a process run.

    IMPORTANT: the rng call sequence below must never be reordered —
    inserting a call in the middle shifts all downstream values.
    New fields must always be appended after existing calls.
    """
    rng = random.Random(hash(symbol) & 0xFFFFFFFF)

    # --- Existing fields (calls 1–9, order frozen) ---
    price = round(rng.uniform(500, 3000), 2)
    spread = price * 0.02

    open_ = round(price + rng.uniform(-spread * 0.5, spread * 0.5), 2)
    high = round(price + rng.uniform(0, spread), 2)
    low = round(price - rng.uniform(0, spread), 2)
    low = min(low, price)
    high = max(high, price)

    vwap_bias = rng.uniform(0.3, 0.7)
    vwap = round(low + vwap_bias * (high - low), 2)

    rsi = round(rng.uniform(30, 75), 1)

    volume = int(rng.uniform(100_000, 5_000_000))
    avg_volume = int(rng.uniform(80_000, 3_000_000))

    prev_close = round(price + rng.uniform(-spread, spread), 2)

    # --- New fields (calls 10+, appended in sequence) ---

    # Call 10: trend bias — drives EMA, MACD, OBV
    trend_bias = rng.uniform(-0.02, 0.02)

    # Call 11: OBV roll
    obv_roll = rng.uniform(-1, 1)

    # Call 12: Bollinger Band width (as fraction of price)
    bb_width = round(rng.uniform(0.01, 0.05), 4)

    # Call 13: Stochastic RSI
    stoch_rsi = round(rng.uniform(0, 100), 1)

    # Call 14: Opening range size (as fraction of price)
    or_range_frac = rng.uniform(0.003, 0.01)

    # Call 15: Sector direction roll
    sector_roll = rng.uniform(0, 1)

    # Call 16: ATR (as fraction of price)
    atr_frac = rng.uniform(0.005, 0.02)

    # --- Derived fields (no rng calls) ---

    # EMAs: trend_bias > 0 → price leads (bullish stack); trend_bias < 0 → bearish stack
    ema9 = round(price * (1 - trend_bias * 0.5), 2)
    ema21 = round(price * (1 - trend_bias * 1.0), 2)
    ema50 = round(price * (1 - trend_bias * 2.0), 2)

    macd_histogram = round(trend_bias * price * 0.002 + rng.uniform(-0.5, 0.5), 2)

    if obv_roll > 0.3:
        obv_direction = "up"
    elif obv_roll < -0.3:
        obv_direction = "down"
    else:
        obv_direction = "flat"

    atr = round(price * atr_frac, 2)

    gap_pct = round((open_ - prev_close) / prev_close, 4) if prev_close != 0 else 0.0

    or_range = round(price * or_range_frac, 2)
    or_high = round(open_ + or_range, 2)
    or_low = round(open_ - or_range, 2)

    if price > or_high:
        or_breakout = "up"
    elif price < or_low:
        or_breakout = "down"
    else:
        or_breakout = "none"

    if sector_roll > 0.6:
        sector_direction = "up"
    elif sector_roll < 0.3:
        sector_direction = "down"
    else:
        sector_direction = "flat"

    volume_ratio = round(volume / avg_volume, 2) if avg_volume > 0 else 0.0

    circuit_high = prev_close * 1.20
    circuit_low = prev_close * 0.80
    near_circuit = (price >= circuit_high * 0.98) or (price <= circuit_low * 1.02)

    # Always True in mock — real implementation checks IST trading hours
    in_time_window = True

    return {
        # Core price data
        "symbol": symbol,
        "price": price,
        "open": open_,
        "high": high,
        "low": low,
        "vwap": vwap,
        "prev_close": prev_close,
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
        "or_high": or_high,
        "or_low": or_low,
        "or_breakout": or_breakout,
        # Market context
        "nifty_direction": _NIFTY_DIRECTION,
        "sector_direction": sector_direction,
        # Filters
        "near_circuit": near_circuit,
        "in_time_window": in_time_window,
    }
