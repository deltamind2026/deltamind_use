def detect_liquidity_sweep(highs, lows, closes):
    prev_high = max(highs[-5:-1])
    prev_low = min(lows[-5:-1])

    if highs[-1] > prev_high and closes[-1] < prev_high:
        return {"liquidity_event": "bull_trap"}

    if lows[-1] < prev_low and closes[-1] > prev_low:
        return {"liquidity_event": "bear_trap"}

    return {"liquidity_event": "none"}

