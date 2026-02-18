def fibonacci_levels(highs, lows):
    swing_high = max(highs[-120:])
    swing_low = min(lows[-120:])

    diff = swing_high - swing_low

    return {
        "0.382": swing_high - diff * 0.382,
        "0.5": swing_high - diff * 0.5,
        "0.618": swing_high - diff * 0.618,
    }

