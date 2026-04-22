def detect_structure(highs, lows):
    if highs[-1] > highs[-2] and lows[-1] > lows[-2]:
        return {"structure": "higher_high"}

    if highs[-1] < highs[-2] and lows[-1] < lows[-2]:
        return {"structure": "lower_low"}

    if highs[-1] < highs[-2] and lows[-1] > lows[-2]:
        return {"structure": "inside_bar"}

    return {"structure": "transition"}

