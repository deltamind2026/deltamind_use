# services/market/metrics/snapshot.py

"""
A plain-language snapshot of a chart: the facts a newcomer needs, measured
from the candles.

The website shows these numbers directly, and the AI only puts them into
words, so the written summary can never disagree with what's on screen.
Everything is measured against the stock's own behavior on this chart, so
the same rules work for a calm ETF on the daily chart and a wild stock on 15m.

There are two layers:
- the tile facts (direction, price swings, range, floor and ceiling)
- the story: the big moves that led to the current price, with dates, and
  what stands out lately. This is what lets the AI say more than the tiles do.
"""

from bisect import bisect_right
from datetime import datetime, timedelta, timezone

import numpy as np

UNITS = {
    "5m": ("5-minute period", "5-minute periods"),
    "15m": ("15-minute period", "15-minute periods"),
    "1h": ("hour", "hours"),
    "4h": ("4-hour period", "4-hour periods"),
    "1d": ("day", "days"),
    "1w": ("week", "weeks"),
}

TREND_BARS = 50    # "direction" looks this far back
RECENT_BARS = 5    # "lately"
SWING_BARS = 20    # recent price swings, compared against the whole chart
PIVOT_WIDTH = 3    # a turning point must top/bottom this many bars on each side
RECORD_BARS = 20   # "highest/lowest since..." is only worth saying past this many bars
BIG_BAR = 2.5      # a single bar this many times the usual move stands out
STREAK_BARS = 4    # this many closes in a row in one direction stands out

# Bar length in minutes for the charts that include extended-hours trading.
# Those bars are thin and jumpy, so they don't count when measuring price
# swings or looking for turning points.
SESSION_MINUTES = {"5m": 5, "15m": 15, "1h": 60}


def _pct(a, b):
    return float((a / b - 1) * 100)


# ---------------- Time ----------------

def _eastern(time_str):
    """Bar start in US Eastern time (candle times are UTC).

    Worked out by hand: Python on Windows has no timezone database built in.
    """
    t = datetime.fromisoformat(str(time_str).replace("Z", "+00:00"))
    if t.tzinfo:
        t = t.astimezone(timezone.utc).replace(tzinfo=None)

    def sunday(month, nth):
        first = datetime(t.year, month, 1)
        return first + timedelta(days=(6 - first.weekday()) % 7 + 7 * (nth - 1))

    # Daylight time runs from 2am on the second Sunday of March to 2am on the first Sunday of November.
    daylight = sunday(3, 2) + timedelta(hours=7) <= t < sunday(11, 1) + timedelta(hours=6)
    return t - timedelta(hours=4 if daylight else 5)


def _stamps(candles, daily):
    """When each bar happened, as shown to readers: a date, plus the time on intraday charts."""
    times = [_eastern(c["time"]) for c in candles]
    return [t.date().isoformat() if daily else t.isoformat(timespec="minutes") for t in times]


def _versus(candles, market):
    """How the overall market moved between two bars of this chart.

    Returns vs(i0, i1): the market's % change from bar i0 to bar i1, or None if
    it has no prices for those dates. `market` is the benchmark's candles on
    the same timeframe (None when there's nothing to compare with).
    """
    if not market:
        return lambda i0, i1: None
    times = [c["time"] for c in market]
    closes = [c["close"] for c in market]

    def at(stamp):
        # the market's latest bar at or before this one, which must be from the same day
        j = bisect_right(times, stamp) - 1
        return j if j >= 0 and times[j][:10] == stamp[:10] else None

    def vs(i0, i1):
        a, b = at(candles[i0]["time"]), at(candles[i1]["time"])
        if a is None or b is None or b <= a:
            return None
        return round(_pct(closes[b], closes[a]), 2)

    return vs


def _in_session(et, minutes):
    """True if any part of the bar falls in regular trading hours (9:30am to 4pm Eastern)."""
    start = et.hour * 60 + et.minute
    return et.weekday() < 5 and start < 16 * 60 and start + minutes > 9 * 60 + 30


# ---------------- Floor and ceiling ----------------

def _turning_points(highs, lows, keep):
    """(bar index, price) wherever the chart reversed: a high above (or low below) its neighbors."""
    idx = np.flatnonzero(keep)
    h, l = highs[idx], lows[idx]
    w = PIVOT_WIDTH
    points = []
    for j in range(w, len(idx) - w):
        if h[j] == h[j - w:j + w + 1].max():
            points.append((int(idx[j]), float(h[j])))
        if l[j] == l[j - w:j + w + 1].min():
            points.append((int(idx[j]), float(l[j])))
    return points


def _level(points, price, side, min_gap, tolerance, major, highs, lows, session, dates):
    """Nearest meaningful turning point below (floor) or above (ceiling) the price.

    Levels closer than `min_gap` are skipped: a "floor" 0.1% away is just noise.
    Among the nearest few, one the chart has turned at more than once (or one of
    its big turns) wins over a one-off wiggle.
    """
    prices = np.array([p for _, p in points])
    if side == "floor":
        candidates = sorted((p for p in points if p[1] < price - min_gap), key=lambda p: -p[1])
    else:
        candidates = sorted((p for p in points if p[1] > price + min_gap), key=lambda p: p[1])
    if not candidates:
        return None

    def near(p):
        return np.abs(prices - p) <= tolerance

    i, lvl = next((c for c in candidates[:3] if near(c[1]).sum() > 1 or c[0] in major), candidates[0])
    last = max(points[k][0] for k in np.flatnonzero(near(lvl)))
    beyond = np.flatnonzero(session & (lows < lvl if side == "floor" else highs > lvl))
    return {
        "price": round(lvl, 2),
        "distance_pct": round(abs(_pct(lvl, price)), 2),
        # how many times the chart turned around near this price, and when it last did
        "touches": int(near(lvl).sum()),
        "last_date": dates[last],
        # the last time the price was on the far side of this level (None: never on this chart)
        "beyond_date": dates[int(beyond[-1])] if len(beyond) else None,
        "is_chart_extreme": bool(lvl == prices.max() or lvl == prices.min()),
    }


# ---------------- Story ----------------

def _swing_points(highs, lows, threshold):
    """The chart's big turns: (bar index, "high" | "low") wherever the price
    reversed by at least `threshold` (a fraction) from its most extreme point."""
    points = []
    hi = lo = 0
    heading = None
    for i in range(1, len(highs)):
        if heading != "down" and highs[i] > highs[hi]:
            hi = i
        if heading != "up" and lows[i] < lows[lo]:
            lo = i
        if heading != "up" and lo < i and highs[i] >= lows[lo] * (1 + threshold):
            points.append((lo, "low"))
            heading, hi = "up", i
        elif heading != "down" and hi < i and lows[i] <= highs[hi] * (1 - threshold):
            points.append((hi, "high"))
            heading, lo = "down", i
    if heading:  # the move still in progress ends at its most extreme point so far
        points.append((hi, "high") if heading == "up" else (lo, "low"))
    return points


def _moves(highs, lows, closes, dates, usual_move, vs, whole=False):
    """The last few big moves, oldest first, ending at the current price.

    With `whole`, the moves cover the entire stretch from its first bar instead
    (used for a period the reader selected, where "now" means the period's end).
    """
    spread = highs.max() / lows.min() - 1
    floor = 3 * usual_move / 100  # anything smaller is ordinary wobble
    # Start with only the very biggest turns and loosen until there's a story to tell.
    for share in (0.5, 0.35, 0.25, 0.18):
        swings = _swing_points(highs, lows, max(share * spread, floor))
        if len(swings) >= (2 if whole else 3):
            break

    stops = [(i, float(highs[i] if kind == "high" else lows[i]), kind) for i, kind in swings]
    # On a full chart, a first leg shorter than 10 bars is just where the chart happens to begin.
    if not stops or stops[0][0] >= (1 if whole else 10):
        stops.insert(0, (0, float(closes[0]), "start"))
    stops.append((len(closes) - 1, float(closes[-1]), "now"))

    moves = []
    for (i0, p0, came_from), (i1, p1, kind) in zip(stops, stops[1:]):
        if i1 == i0:
            continue
        move = {
            "from": {"date": dates[i0], "price": round(p0, 2)},
            "to": {"date": dates[i1], "price": round(p1, 2), "kind": kind},
            "change_pct": round(_pct(p1, p0), 2),
            "market_change_pct": vs(i0, i1),
            "bars": i1 - i0,
        }
        if kind == "now" and came_from != "start":
            # The latest leg hasn't reversed enough to count as a new big move, but
            # it may have gone well past the current price and come back.
            leg = (lows if came_from == "high" else highs)[i0:i1 + 1]
            j = int(leg.argmin() if came_from == "high" else leg.argmax())
            if abs(_pct(leg[j], p1)) >= 3 * usual_move:
                move["via"] = {"date": dates[i0 + j], "price": round(float(leg[j]), 2),
                               "kind": "low" if came_from == "high" else "high"}
        moves.append(move)
    return (moves if whole else moves[-4:]), {i for i, _ in swings}


def _record(closes, dates):
    """Is this the highest or lowest close in a long while? Since when?"""
    price, earlier = closes[-1], closes[:-1]
    for kind, beyond in (("highest", earlier >= price), ("lowest", earlier <= price)):
        hits = np.flatnonzero(beyond)
        bars = len(earlier) - int(hits[-1]) if len(hits) else len(earlier)
        if bars >= RECORD_BARS:
            # since=None means nothing on the chart beats it
            return {"kind": kind, "bars": bars, "since": dates[int(hits[-1])] if len(hits) else None}
    return None


def _big_bars(closes, dates, usual_move, vs):
    """Single bars in the last two weeks or so that moved far more than usual."""
    changes = np.diff(closes) / closes[:-1] * 100
    recent = [i for i in range(len(changes) - 10, len(changes)) if abs(changes[i]) >= BIG_BAR * usual_move]
    recent = sorted(sorted(recent, key=lambda i: -abs(changes[i]))[:2])
    return [{
        "date": dates[i + 1],
        "change_pct": round(float(changes[i]), 2),
        "times_usual": round(float(abs(changes[i]) / usual_move), 1),
        "market_change_pct": vs(i, i + 1),
        # the biggest single-bar rise (or fall) anywhere on the chart
        "is_chart_record": bool(changes[i] in (changes.max(), changes.min())),
    } for i in recent]


def _streak(closes):
    signs = np.sign(np.diff(closes))[::-1]
    run = 0
    while run < len(signs) and signs[run] == signs[0] != 0:
        run += 1
    if run < STREAK_BARS:
        return None
    return {"direction": "up" if signs[0] > 0 else "down", "bars": run}


# ---------------- Snapshot ----------------

def build_snapshot(candles, tf, market=None):
    """`market`: the benchmark's candles on the same timeframe, to compare against."""
    if not candles or len(candles) < 30:
        return {"error": "not_enough_data"}

    closes = np.array([c["close"] for c in candles], dtype=float)
    highs = np.array([c["high"] for c in candles], dtype=float)
    lows = np.array([c["low"] for c in candles], dtype=float)
    volumes = np.array([c.get("volume") or 0 for c in candles], dtype=float)
    times = [_eastern(c["time"]) for c in candles]
    price = closes[-1]
    one, many = UNITS.get(tf, ("bar", "bars"))
    daily = tf in ("1d", "1w")
    days = [t.date() for t in times]
    dates = _stamps(candles, daily)

    # Regular-hours bars. On daily charts (or if the filter leaves too little, e.g.
    # for something that trades around the clock) every bar counts.
    session = np.ones(len(candles), dtype=bool)
    if tf in SESSION_MINUTES:
        regular = np.array([_in_session(t, SESSION_MINUTES[tf]) for t in times])
        if regular.sum() >= 30:
            session = regular

    # ---------------- Price swings ----------------
    # Average size of a single bar's move, ignoring direction. Intraday, a move
    # only counts between two regular-hours bars on the same day, so overnight
    # jumps and sleepy after-hours bars don't distort it.
    moves = np.abs(np.diff(closes) / closes[:-1] * 100)
    counted = session[1:] & session[:-1]
    if not daily:
        counted &= np.array([a == b for a, b in zip(days[1:], days[:-1])])
    if counted.sum() >= SWING_BARS:
        moves = moves[counted]
    typical_move = float(moves[-SWING_BARS:].mean())
    usual_move = float(moves.mean()) or 1e-9
    swing_ratio = typical_move / usual_move

    if swing_ratio < 0.75:
        swings = "calmer"
    elif swing_ratio > 1.33:
        swings = "wilder"
    else:
        swings = "normal"

    # ---------------- Direction ----------------
    n = min(TREND_BARS, len(closes) - 1)
    trend_change = _pct(price, closes[-1 - n])
    average = closes[-n:].mean()
    # A move only counts as a trend if it's big compared to the stock's normal
    # noise over that many bars (random wandering grows with sqrt(n)).
    threshold = 0.6 * usual_move * np.sqrt(n)

    if trend_change > threshold and price > average:
        direction = "up"
    elif trend_change < -threshold and price < average:
        direction = "down"
    else:
        direction = "sideways"

    # How big a change over RECENT_BARS normally is, to judge the latest one against.
    recent_usual = float(np.abs(closes[RECENT_BARS:] / closes[:-RECENT_BARS] - 1).mean() * 100)

    # ---------------- Where it sits ----------------
    hi_i, lo_i = int(highs.argmax()), int(lows.argmin())
    hi, lo = float(highs[hi_i]), float(lows[lo_i])
    position = (price - lo) / (hi - lo) if hi > lo else 0.5
    where = ("top" if position >= 0.8 else "upper" if position >= 0.6 else
             "middle" if position > 0.4 else "lower" if position > 0.2 else "bottom")

    # ---------------- Story ----------------
    vs = _versus(candles, market)
    big_moves, swing_bars = _moves(highs, lows, closes, dates, usual_move, vs)

    # ---------------- Floor and ceiling ----------------
    points = _turning_points(highs, lows, session)
    # The chart's own high and low count too, even if they're too recent to
    # have confirmed as turning points (e.g. it hit a new high yesterday).
    points += [p for p in ((hi_i, hi), (lo_i, lo)) if p not in points]
    bar_move = price * usual_move / 100
    min_gap = max(bar_move, 0.04 * (hi - lo))
    major = swing_bars | {hi_i, lo_i}
    level = lambda side: _level(points, price, side, min_gap, bar_move / 2, major, highs, lows, session, dates)

    # ---------------- Trading activity ----------------
    # Daily/weekly only: intraday charts include near-empty after-hours bars,
    # which would make every evening look "unusually quiet".
    activity = None
    if daily and volumes[-n:].mean() > 0:
        ratio = float(volumes[-RECENT_BARS:].mean() / volumes[-n:].mean())
        activity = {
            "label": "busier" if ratio > 1.4 else "quieter" if ratio < 0.7 else "normal",
            "ratio": round(ratio, 2),
        }

    return {
        "price": round(float(price), 2),
        "unit": {"one": one, "many": many},
        "bars": len(candles),
        "start_date": dates[0],
        "date": dates[-1],
        "trend": {
            "direction": direction,
            "change_pct": round(trend_change, 2),
            "bars": n,
            "since": dates[-1 - n],
            "above_average": bool(price > average),
            "recent_change_pct": round(_pct(price, closes[-1 - RECENT_BARS]), 2),
            "recent_bars": RECENT_BARS,
            "recent_since": dates[-1 - RECENT_BARS],
            "recent_usual_pct": round(recent_usual, 2),
            # the overall market over the same two stretches (None: nothing to compare with)
            "market_change_pct": vs(len(closes) - 1 - n, len(closes) - 1),
            "market_recent_change_pct": vs(len(closes) - 1 - RECENT_BARS, len(closes) - 1),
        },
        "swings": {
            "label": swings,
            "typical_move_pct": round(typical_move, 2),
            "usual_move_pct": round(usual_move, 2),
        },
        "range": {
            "low": round(lo, 2),
            "low_date": dates[lo_i],
            "high": round(hi, 2),
            "high_date": dates[hi_i],
            "position": round(float(position), 3),
            "where": where,
            "from_high_pct": round(abs(_pct(price, hi)), 2),
            "from_low_pct": round(abs(_pct(price, lo)), 2),
        },
        "levels": {"floor": level("floor"), "ceiling": level("ceiling")},
        "activity": activity,
        "story": {
            "moves": big_moves,
            "record": _record(closes, dates),
            # Single-bar jumps and streaks are only meaningful on daily/weekly
            # charts; intraday they'd mostly pick up the overnight gap.
            "big_bars": _big_bars(closes, dates, usual_move, vs) if daily else [],
            "streak": _streak(closes) if daily else None,
        },
    }
