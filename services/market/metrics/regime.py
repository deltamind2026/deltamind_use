import numpy as np

def classify_regime(closes, lookback=50):
    closes = np.array(closes[-lookback:])

    returns = np.diff(closes)
    volatility = np.std(returns)
    directional = abs(closes[-1] - closes[0])

    efficiency = directional / (np.sum(abs(returns)) + 1e-9)

    if efficiency > 0.6:
        return {"regime": "trend", "confidence": float(efficiency)}

    if volatility < np.percentile(abs(returns), 25):
        return {"regime": "compression", "confidence": 0.7}

    if efficiency < 0.3:
        return {"regime": "chop", "confidence": 0.8}

    return {"regime": "range", "confidence": 0.6}

