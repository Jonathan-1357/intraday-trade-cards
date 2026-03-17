from dataclasses import dataclass, field

from app.services.risk_calculator import calculate_atr_stop_loss

# ---------------------------------------------------------------------------
# Tier 1: Hard Gates
# Each returns (passed: bool, reason: str).
# Any failure → confidence = "none", no card generated.
# ---------------------------------------------------------------------------

def gate_in_time_window(q: dict) -> tuple[bool, str]:
    return q["in_time_window"], "valid trading hours"


def gate_not_near_circuit(q: dict) -> tuple[bool, str]:
    passed = not q["near_circuit"]
    return passed, "not near circuit breaker"


def gate_volume_ratio(q: dict) -> tuple[bool, str]:
    passed = q["volume_ratio"] >= 0.5
    return passed, f"volume ratio {q['volume_ratio']:.2f}x (min 0.5x)"


def gate_atr_minimum(q: dict) -> tuple[bool, str]:
    passed = q["atr"] >= 5.0
    return passed, f"ATR ₹{q['atr']:.2f} (min ₹5)"


def gate_sl_valid(entry: float, sl: float) -> tuple[bool, str]:
    if sl <= 0:
        return False, f"ATR-based SL ₹{sl:.2f} is not positive"
    if entry == sl:
        return False, "entry equals stop loss"
    return True, f"SL ₹{sl:.2f} valid"


_HARD_GATES = [
    gate_in_time_window,
    gate_not_near_circuit,
    gate_volume_ratio,
    gate_atr_minimum,
]


# ---------------------------------------------------------------------------
# Tier 2: Confirmation Rules (1 point each)
# ---------------------------------------------------------------------------

# -- Buy --
def conf_buy_price_above_vwap(q: dict) -> tuple[bool, str]:
    return q["price"] > q["vwap"], "price above VWAP"


def conf_buy_rsi_zone(q: dict) -> tuple[bool, str]:
    return 55 <= q["rsi"] <= 73, f"RSI {q['rsi']:.1f} in bullish zone (55–73)"


def conf_buy_ema_stack(q: dict) -> tuple[bool, str]:
    passed = q["price"] > q["ema9"] and q["ema9"] > q["ema21"]
    return passed, "EMA stack bullish (price > ema9 > ema21)"


def conf_buy_macd(q: dict) -> tuple[bool, str]:
    return q["macd_histogram"] > 0, "MACD histogram positive"


def conf_buy_obv(q: dict) -> tuple[bool, str]:
    return q["obv_direction"] == "up", "OBV trending up"


def conf_buy_nifty(q: dict) -> tuple[bool, str]:
    return q["nifty_direction"] != "down", f"Nifty {q['nifty_direction']} (not against trade)"


def conf_buy_stoch_rsi(q: dict) -> tuple[bool, str]:
    return q["stoch_rsi"] < 80, f"StochRSI {q['stoch_rsi']:.1f} below overbought (< 80)"


# -- Sell --
def conf_sell_price_below_vwap(q: dict) -> tuple[bool, str]:
    return q["price"] < q["vwap"], "price below VWAP"


def conf_sell_rsi_zone(q: dict) -> tuple[bool, str]:
    return 27 <= q["rsi"] <= 45, f"RSI {q['rsi']:.1f} in bearish zone (27–45)"


def conf_sell_ema_stack(q: dict) -> tuple[bool, str]:
    passed = q["price"] < q["ema9"] and q["ema9"] < q["ema21"]
    return passed, "EMA stack bearish (price < ema9 < ema21)"


def conf_sell_macd(q: dict) -> tuple[bool, str]:
    return q["macd_histogram"] < 0, "MACD histogram negative"


def conf_sell_obv(q: dict) -> tuple[bool, str]:
    return q["obv_direction"] == "down", "OBV trending down"


def conf_sell_nifty(q: dict) -> tuple[bool, str]:
    return q["nifty_direction"] != "up", f"Nifty {q['nifty_direction']} (not against trade)"


def conf_sell_stoch_rsi(q: dict) -> tuple[bool, str]:
    return q["stoch_rsi"] > 20, f"StochRSI {q['stoch_rsi']:.1f} above oversold (> 20)"


_BUY_CONF_RULES = [
    conf_buy_price_above_vwap,
    conf_buy_rsi_zone,
    conf_buy_ema_stack,
    conf_buy_macd,
    conf_buy_obv,
    conf_buy_nifty,
    conf_buy_stoch_rsi,
]

_SELL_CONF_RULES = [
    conf_sell_price_below_vwap,
    conf_sell_rsi_zone,
    conf_sell_ema_stack,
    conf_sell_macd,
    conf_sell_obv,
    conf_sell_nifty,
    conf_sell_stoch_rsi,
]


# ---------------------------------------------------------------------------
# Tier 3: Bonus Rules (0.5 points each)
# ---------------------------------------------------------------------------

def bonus_buy_or_breakout(q: dict) -> tuple[bool, str]:
    return q["or_breakout"] == "up", "opening range breakout (up)"


def bonus_buy_sector(q: dict) -> tuple[bool, str]:
    return q["sector_direction"] == "up", f"sector trending up"


def bonus_buy_bb_squeeze(q: dict) -> tuple[bool, str]:
    passed = q["bb_width"] < 0.02
    return passed, f"Bollinger squeeze (width {q['bb_width']:.3f} < 2%)"


def bonus_sell_or_breakout(q: dict) -> tuple[bool, str]:
    return q["or_breakout"] == "down", "opening range breakout (down)"


def bonus_sell_sector(q: dict) -> tuple[bool, str]:
    return q["sector_direction"] == "down", f"sector trending down"


def bonus_sell_bb_squeeze(q: dict) -> tuple[bool, str]:
    passed = q["bb_width"] < 0.02
    return passed, f"Bollinger squeeze (width {q['bb_width']:.3f} < 2%)"


_BUY_BONUS_RULES = [
    bonus_buy_or_breakout,
    bonus_buy_sector,
    bonus_buy_bb_squeeze,
]

_SELL_BONUS_RULES = [
    bonus_sell_or_breakout,
    bonus_sell_sector,
    bonus_sell_bb_squeeze,
]


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------

def _score_to_confidence(score: float) -> str:
    if score >= 6:
        return "strong"
    if score >= 4:
        return "valid"
    if score >= 2:
        return "weak"
    return "none"


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

@dataclass
class SignalResult:
    action: str
    entry: float
    stop_loss: float
    target: float
    confidence: str
    reasons: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Main evaluation function
# ---------------------------------------------------------------------------

def evaluate_signal(quote: dict) -> SignalResult:
    price = quote["price"]
    atr = quote["atr"]

    # --- Tier 1: direction-agnostic hard gates ---
    gate_results = [fn(quote) for fn in _HARD_GATES]
    failed = [(ok, msg) for ok, msg in gate_results if not ok]
    if failed:
        return SignalResult(
            action="buy",
            entry=round(price, 2),
            stop_loss=round(price - atr, 2),
            target=round(price + 2 * atr, 2),
            confidence="none",
            reasons=[f"blocked: {msg}" for _, msg in failed],
        )

    # --- Score both directions ---
    buy_conf = [fn(quote) for fn in _BUY_CONF_RULES]
    sell_conf = [fn(quote) for fn in _SELL_CONF_RULES]
    buy_bonus = [fn(quote) for fn in _BUY_BONUS_RULES]
    sell_bonus = [fn(quote) for fn in _SELL_BONUS_RULES]

    buy_score = sum(1.0 for ok, _ in buy_conf if ok) + sum(0.5 for ok, _ in buy_bonus if ok)
    sell_score = sum(1.0 for ok, _ in sell_conf if ok) + sum(0.5 for ok, _ in sell_bonus if ok)

    if buy_score >= sell_score:
        action = "buy"
        conf_results, bonus_results, score = buy_conf, buy_bonus, buy_score
    else:
        action = "sell"
        conf_results, bonus_results, score = sell_conf, sell_bonus, sell_score

    # --- Tier 1 (cont): SL validity gate ---
    sl = calculate_atr_stop_loss(price, atr, action)
    risk = abs(price - sl)
    target = round(price + 2 * risk, 2) if action == "buy" else round(price - 2 * risk, 2)

    sl_ok, sl_msg = gate_sl_valid(price, sl)
    if not sl_ok:
        return SignalResult(
            action=action,
            entry=round(price, 2),
            stop_loss=round(sl, 2),
            target=target,
            confidence="none",
            reasons=[f"blocked: {sl_msg}"],
        )

    confidence = _score_to_confidence(score)

    # --- Assemble reasons (passing items only, labelled by tier) ---
    reasons: list[str] = []
    for ok, msg in conf_results:
        if ok:
            reasons.append(msg)
    for ok, msg in bonus_results:
        if ok:
            reasons.append(f"[+] {msg}")

    return SignalResult(
        action=action,
        entry=round(price, 2),
        stop_loss=round(sl, 2),
        target=target,
        confidence=confidence,
        reasons=reasons,
    )
