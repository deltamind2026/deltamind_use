def summarize_state(state):
    return {
        "regime": state.get("regime"),
        "ema_trend": state.get("ema_trend"),
        "pattern": state.get("pattern"),
        "volatility": state.get("volatility_state")
    }


def combine_timeframes(states):
    """
    Converts multiple timeframe states into a single narrative structure
    """

    micro = summarize_state(states.get("5m",{}))
    intra = summarize_state(states.get("1h",{}))
    swing = summarize_state(states.get("1d",{}))
    macro = summarize_state(states.get("1w",{}))

    alignment = "mixed"

    if micro["ema_trend"]==intra["ema_trend"]==swing["ema_trend"]:
        alignment="aligned"

    if macro["ema_trend"]!=swing["ema_trend"]:
        alignment="counter_trend"

    return {
        "micro":micro,
        "intraday":intra,
        "swing":swing,
        "macro":macro,
        "alignment":alignment
    }

