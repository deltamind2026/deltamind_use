import numpy as np

def ema(values, period):
    values = np.array(values, dtype=float)
    k = 2 / (period + 1)
    ema_vals = [values[0]]

    for price in values[1:]:
        ema_vals.append(price * k + ema_vals[-1] * (1 - k))

    return ema_vals


def ema_stack(closes):
    return {
        "ema9": ema(closes, 9)[-1],
        "ema21": ema(closes, 21)[-1],
        "ema50": ema(closes, 50)[-1],
        "ema200": ema(closes, 200)[-1],
    }


def ema_trend(emas):
    if emas["ema9"] > emas["ema21"] > emas["ema50"] > emas["ema200"]:
        return "strong_uptrend"
    if emas["ema9"] < emas["ema21"] < emas["ema50"] < emas["ema200"]:
        return "strong_downtrend"
    return "mixed"

