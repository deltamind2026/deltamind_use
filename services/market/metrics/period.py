# services/market/metrics/period.py

"""
Facts about one stretch of a chart that the reader dragged across: the shape
of the move inside it, how unusual it was for this stock, and what came before
and after.

Same idea as snapshot.py: the math settles the facts and the AI only words
them, so the explanation can't disagree with the chart.
"""

import numpy as np

from .snapshot import BIG_BAR, UNITS, _moves, _pct, _stamps, _versus


def build_period(candles, tf, start, end, market=None):
    """`start` and `end` are bar positions in `candles`, both included.
    `market`: the benchmark's candles on the same timeframe, to compare against."""
    if not candles or not 0 <= start < end < len(candles) or end - start < 2:
        return {"error": "not_enough_data"}

    closes = np.array([c["close"] for c in candles], dtype=float)
    highs = np.array([c["high"] for c in candles], dtype=float)
    lows = np.array([c["low"] for c in candles], dtype=float)
    volumes = np.array([c.get("volume") or 0 for c in candles], dtype=float)
    daily = tf in ("1d", "1w")
    dates = _stamps(candles, daily)
    one, many = UNITS.get(tf, ("bar", "bars"))

    inside = slice(start, end + 1)
    n = end - start  # how many bars the price had to move
    last = len(candles) - 1

    changes = np.diff(closes) / closes[:-1] * 100
    usual_move = float(np.abs(changes).mean()) or 1e-9

    # How big a change over this many bars normally is on this chart. Skipped
    # when the selection covers so much of the chart there's little to compare with.
    usual_change = None
    if len(closes) - n >= 10:
        usual_change = round(float(np.abs(closes[n:] / closes[:-n] - 1).mean() * 100), 2)

    hi_i = start + int(highs[inside].argmax())
    lo_i = start + int(lows[inside].argmin())

    vs = _versus(candles, market)
    moves, _ = _moves(highs[inside], lows[inside], closes[inside], dates[inside], usual_move,
                      lambda i0, i1: vs(start + i0, start + i1), whole=True)

    steps = np.sign(np.diff(closes[inside]))

    # The one bar that moved the most, if it was far more than this stock usually
    # moves. Daily/weekly only: intraday this would mostly be the overnight gap.
    big_bar = None
    k = start + int(np.abs(changes[start:end]).argmax())  # changes[k] is the move into bar k + 1
    if daily and abs(changes[k]) >= BIG_BAR * usual_move:
        big_bar = {
            "date": dates[k + 1],
            "change_pct": round(float(changes[k]), 2),
            "times_usual": round(float(abs(changes[k]) / usual_move), 1),
            "market_change_pct": vs(k, k + 1),
            "is_chart_record": bool(changes[k] in (changes.max(), changes.min())),
        }

    activity = None
    if daily and volumes.mean() > 0:
        ratio = float(volumes[inside].mean() / volumes.mean())
        activity = {
            "label": "busier" if ratio > 1.4 else "quieter" if ratio < 0.7 else "normal",
            "ratio": round(ratio, 2),
        }

    # The run-in: the same number of bars before the selection, or as many as there are.
    before = None
    lead = min(n, start)
    if lead >= 3:
        before = {"bars": lead, "since": dates[start - lead],
                  "change_pct": round(_pct(closes[start], closes[start - lead]), 2),
                  "market_change_pct": vs(start - lead, start)}

    after = None
    if end < last:
        after = {"bars": last - end, "date": dates[last], "price": round(float(closes[last]), 2),
                 "change_pct": round(_pct(closes[last], closes[end]), 2)}

    return {
        "unit": {"one": one, "many": many},
        "bars": n + 1,
        "chart": {"start_date": dates[0], "date": dates[last]},
        "start": {"date": dates[start], "price": round(float(closes[start]), 2)},
        "end": {"date": dates[end], "price": round(float(closes[end]), 2)},
        "change_pct": round(_pct(closes[end], closes[start]), 2),
        "market_change_pct": vs(start, end),  # the overall market over the same dates
        "usual_change_pct": usual_change,
        "high": {"date": dates[hi_i], "price": round(float(highs[hi_i]), 2),
                 "is_chart_high": bool(highs[hi_i] == highs.max())},
        "low": {"date": dates[lo_i], "price": round(float(lows[lo_i]), 2),
                "is_chart_low": bool(lows[lo_i] == lows.min())},
        "moves": moves,
        "up_bars": int((steps > 0).sum()),
        "down_bars": int((steps < 0).sum()),
        "big_bar": big_bar,
        "activity": activity,
        "before": before,
        "after": after,
    }
