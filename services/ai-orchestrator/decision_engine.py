# services/ai-orchestrator/decision_engine.py

from typing import Dict, Any, List


# -----------------------------------------------------
# Helper Rules
# -----------------------------------------------------

def determine_bias(state: Dict[str, Any], multi: Dict[str, Any]) -> str:

    regime = state.get("regime")
    ema = state.get("ema_trend")
    alignment = multi.get("alignment")

    if alignment == "bullish" and ema in ["strong_uptrend", "uptrend"]:
        return "bullish"

    if alignment == "bearish" and ema in ["strong_downtrend", "downtrend"]:
        return "bearish"

    if regime == "range":
        return "neutral"

    return "neutral"


def determine_strength(state: Dict[str, Any]) -> str:
    vol = state.get("volatility_state")
    rarity = state.get("rarity_score")

    if vol == "expanding" and rarity == "high":
        return "strong"

    if vol == "contracting":
        return "weak"

    return "moderate"


def determine_horizon(multi: Dict[str, Any]) -> str:
    dominant = multi.get("dominant_tf")

    mapping = {
        "5m": "scalp",
        "1h": "intraday",
        "1d": "swing",
        "1w": "position"
    }

    return mapping.get(dominant, "intraday")


def determine_risk(state: Dict[str, Any], options: List[Dict]) -> str:

    vol = state.get("volatility_state")

    if vol == "expanding":
        return "high"

    if options:
        iv = sum(o.get("iv", 0) for o in options if o.get("iv")) / max(len(options),1)
        if iv > 0.6:
            return "high"

    return "medium"


def determine_strategy(state: Dict[str, Any]) -> str:

    regime = state.get("regime")
    structure = state.get("structure")

    if regime == "trend":
        if structure == "pullback":
            return "pullback_continuation"
        return "trend_continuation"

    if regime == "range":
        return "mean_reversion"

    return "wait"


def determine_options_context(state: Dict[str, Any], options: List[Dict]) -> str:

    vol = state.get("volatility_state")

    if not options:
        return "no_options_data"

    avg_iv = sum(o.get("iv", 0) for o in options if o.get("iv")) / max(len(options),1)

    if avg_iv > 0.7:
        return "sell_premium"

    if avg_iv < 0.3:
        return "buy_options"

    if vol == "expanding":
        return "long_gamma"

    return "neutral"


def build_entry_and_invalidation(state: Dict[str, Any]):

    levels = state.get("levels") or []
    fib = state.get("fibonacci") or {}

    entry = None
    invalidation = None

    if levels:
        entry = min(levels)
        invalidation = max(levels)

    if "0.618" in fib:
        entry = fib["0.618"]

    return entry, invalidation


# -----------------------------------------------------
# MAIN DECISION ENGINE
# -----------------------------------------------------

def build_trade_decision(
    market_state: Dict[str, Any],
    multi_timeframe: Dict[str, Any],
    options: List[Dict]
) -> Dict[str, Any]:

    bias = determine_bias(market_state, multi_timeframe)
    strength = determine_strength(market_state)
    horizon = determine_horizon(multi_timeframe)
    risk = determine_risk(market_state, options)
    strategy = determine_strategy(market_state)
    options_ctx = determine_options_context(market_state, options)

    entry, invalidation = build_entry_and_invalidation(market_state)

    return {
        "bias": bias,
        "strength": strength,
        "strategy": strategy,
        "time_horizon": horizon,
        "risk": risk,
        "entry_zone": entry,
        "invalidation_level": invalidation,
        "options_strategy": options_ctx,
        "confidence": "high" if strength == "strong" else "moderate",
        "notes": [
            f"regime={market_state.get('regime')}",
            f"ema={market_state.get('ema_trend')}",
            f"volatility={market_state.get('volatility_state')}"
        ]
    }
