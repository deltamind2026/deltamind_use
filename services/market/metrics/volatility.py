import numpy as np

def volatility_state(highs, lows, closes):
    ranges = np.array(highs) - np.array(lows)

    current = ranges[-1]
    percentile = np.sum(ranges < current) / len(ranges)

    if percentile < 0.2:
        state = "compressed"
    elif percentile > 0.8:
        state = "expanded"
    else:
        state = "normal"

    expansion_prob = 1 - percentile

    return {
        "volatility_state": state,
        "expansion_probability": float(expansion_prob)
    }

