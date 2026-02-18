from typing import Dict, Any, List, Optional

# Trade Planning Engine
from decision_engine import build_trade_decision


# =========================================================
# Helpers
# =========================================================

def last_candle_stats(candle: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert raw OHLC candle into semantic description
    """

    if not candle:
        return {}

    o = candle.get("open")
    h = candle.get("high")
    l = candle.get("low")
    c = candle.get("close")

    if None in (o, h, l, c):
        return {}

    body = abs(c - o)
    range_ = max(h - l, 1e-9)

    return {
        "direction": "bullish" if c > o else "bearish",
        "body_percent": round(body / range_, 3),
        "upper_wick": round((h - max(o, c)) / range_, 3),
        "lower_wick": round((min(o, c) - l) / range_, 3),
    }


# ---------------------------------------------------------

def summarize_market_state(state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Clean noisy metric engine output into stable LLM input
    """

    if not state:
        return {}

    return {
        "regime": state.get("regime"),
        "trend_strength": state.get("trend_strength"),
        "volatility": state.get("volatility_state"),
        "rarity": state.get("rarity_score"),
        "pattern": state.get("pattern"),
        "liquidity_event": state.get("liquidity_event"),
        "ema_trend": state.get("ema_trend"),
        "structure": state.get("structure"),
    }


# ---------------------------------------------------------

def summarize_levels(state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not state:
        return {}

    return {
        "support_resistance": state.get("levels"),
        "fibonacci": state.get("fibonacci"),
    }


# ---------------------------------------------------------

def add_multi_timeframe(chart_intel: Dict[str, Any], multi: Optional[Dict[str, Any]]):
    """
    Attach multi timeframe alignment intelligence
    """

    if not multi:
        chart_intel["multi_timeframe"] = {}
        return chart_intel

    chart_intel["multi_timeframe"] = {
        "alignment": multi.get("alignment"),
        "dominant_tf": multi.get("dominant_tf"),
        "conflict": multi.get("conflict"),
        "summary": multi.get("summary"),
    }

    return chart_intel


# =========================================================
# Main Intelligence Builder
# =========================================================

def build_chart_intel(
    asset: str,
    timeframe: str,
    candles: List[Dict[str, Any]],
    market_state: Optional[Dict[str, Any]] = None,
    indicators: Optional[Dict[str, Any]] = None,
    levels: Optional[Dict[str, Any]] = None,
    multi_timeframe: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Convert raw technical data into structured trading intelligence.
    This is the ONLY object the AI ever sees.
    """

    if not candles:
        return {"error": "no_candles"}

    last = candles[-1]

    # ---------------- Candle Meaning ----------------
    candle_context = last_candle_stats(last)

    # ---------------- Market Meaning ----------------
    state_summary = summarize_market_state(market_state)
    level_summary = summarize_levels(market_state)

    # ---------------- Extract Options Context ----------------
    options_data = []
    if indicators and isinstance(indicators, dict):
        options_data = indicators.get("options", []) or []

    # ---------------- Decision Engine ----------------
    decision = build_trade_decision(
        market_state or {},
        multi_timeframe or {},
        options_data
    )

    # ---------------- Final Structured Intelligence ----------------
    chart_intel = {
        # Identity
        "asset": asset,
        "timeframe": timeframe,

        # Price
        "current_price": last.get("close"),

        # Behavior
        "last_candle": candle_context,
        "market_behavior": state_summary,

        # Levels
        "key_levels": level_summary,

        # Multi-timeframe context (filled below)
        "multi_timeframe": {},

        # Decision Layer (CORE FEATURE)
        "decision": decision,

        # Optional raw context
        "indicator_context": indicators or {},

        # LLM instruction (anti-hallucination contract)
        "instruction": (
            "Explain the trading context, what traders are watching, "
            "risk factors, and possible actions. "
            "Do NOT predict future price or give financial advice."
        ),
    }

    # Attach multi timeframe alignment
    chart_intel = add_multi_timeframe(chart_intel, multi_timeframe)

    return chart_intel

