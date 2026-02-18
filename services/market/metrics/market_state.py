# services/market/metrics/market_state.py

from .regime import classify_regime
from .volatility import volatility_state
from .structure import detect_structure
from .liquidity import detect_liquidity_sweep
from .statistics import rarity_score

# New human-visual logic
from .ema import ema_stack, ema_trend
from .levels import support_resistance
from .fibonacci import fibonacci_levels
from .patterns import detect_patterns


def build_market_state(candles):
    """
    Converts raw candles into a structured market behavior description.

    This is the core intelligence layer of DeltaMind.
    It combines statistical, behavioral, and visual trader logic.
    """

    # ---------------- Safety ----------------
    if not candles or len(candles) < 10:
        return {"error": "not_enough_data"}

    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    closes = [c["close"] for c in candles]

    state = {}

    # =====================================================
    # 1) BEHAVIORAL MARKET LOGIC (quantitative truth)
    # =====================================================

    try:
        state.update(classify_regime(closes))
    except Exception:
        state["regime"] = "unknown"

    try:
        state.update(volatility_state(highs, lows, closes))
    except Exception:
        state["volatility_state"] = "unknown"

    try:
        state.update(detect_structure(highs, lows))
    except Exception:
        state["structure"] = "unknown"

    try:
        state.update(detect_liquidity_sweep(highs, lows, closes))
    except Exception:
        state["liquidity_event"] = "unknown"

    try:
        state.update(rarity_score(closes))
    except Exception:
        state["rarity_score"] = 0.0

    # =====================================================
    # 2) HUMAN VISUAL LOGIC (what traders actually see)
    # =====================================================

    # ----- EMA Trend Hierarchy -----
    try:
        emas = ema_stack(closes)
        state["ema_values"] = emas
        state["ema_trend"] = ema_trend(emas)
    except Exception:
        state["ema_values"] = {}
        state["ema_trend"] = "unknown"

    # ----- Support & Resistance Zones -----
    try:
        state["levels"] = support_resistance(highs, lows)
    except Exception:
        state["levels"] = []

    # ----- Fibonacci Retracement -----
    try:
        state["fibonacci"] = fibonacci_levels(highs, lows)
    except Exception:
        state["fibonacci"] = {}

    # ----- Pattern Detection -----
    try:
        state.update(detect_patterns(highs, lows, closes))
    except Exception:
        state["pattern"] = "none"

    # =====================================================
    # FINAL STATE
    # =====================================================

    return state

