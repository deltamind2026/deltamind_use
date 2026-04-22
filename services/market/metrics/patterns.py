def detect_patterns(highs, lows, closes):

    # Double top
    if abs(highs[-1] - highs[-3]) / highs[-1] < 0.002:
        return {"pattern": "double_top"}

    # Double bottom
    if abs(lows[-1] - lows[-3]) / lows[-1] < 0.002:
        return {"pattern": "double_bottom"}

    # Bull flag (tight pullback after rise)
    if closes[-5] < closes[-4] < closes[-3] and closes[-2] < closes[-3]:
        return {"pattern": "bull_flag"}

    return {"pattern": "none"}

