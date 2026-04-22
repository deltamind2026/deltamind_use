def support_resistance(highs, lows, lookback=120, tolerance=0.003):
    levels = []

    for i in range(2, len(highs)-2):
        if highs[i] > highs[i-1] and highs[i] > highs[i+1]:
            levels.append(highs[i])
        if lows[i] < lows[i-1] and lows[i] < lows[i+1]:
            levels.append(lows[i])

    # cluster nearby levels into zones
    zones = []
    for lvl in levels:
        placed = False
        for z in zones:
            if abs(z - lvl)/lvl < tolerance:
                placed = True
                break
        if not placed:
            zones.append(lvl)

    return sorted(zones)[-5:]  # return most recent zones

