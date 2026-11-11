# services/ai-orchestrator/main.py

import math
import re
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from openai_client import get_json

# ===================================================
# App
# ===================================================

app = FastAPI(title="DeltaMind AI Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================================
# Health
# ===================================================

@app.get("/ai/hello")
def hello():
    return {
        "ok": True,
        "service": "DeltaMind AI orchestrator running"
    }



# ===================================================
# Chart Summary
# ===================================================

# Who we're writing for, and what the model may and may not say. Shared by
# every prompt so the site speaks with one voice.
READER = """Picture the reader as a sharp friend who works outside finance. Prices, percentages and dates are no problem for them. What they lack is trader vocabulary and a sense of which features of a chart matter. They don't want reassurance, disclaimers or a lesson; they want someone who can read the chart to tell them plainly what it shows."""

RULES = """Each request gives you facts measured from the chart. They are everything you know:
- Every price, percentage and date you mention has to come from the facts. Copy prices exactly; a percentage may be rounded to a whole number. Don't work out new figures of your own.
- You know the price history and nothing else: no news, no earnings, nothing about the company. So say what the price did, never why.
- Where the facts give the S&P 500's change over the same stretch, that is the overall US stock market, there for comparison. Bring it in when the contrast is telling: the stock fell far more than the market, say, or rose while the market fell. Call it "the overall market" or "the S&P 500". It shows whether the stock moved along with everything else or on its own; it doesn't explain why.
- Describe, don't advise or predict. Nothing about buying, selling or waiting, and nothing about where the price is headed. Saying what a move would mean on this chart is fine ("a fall below $164.27 would be its lowest price on this chart"); saying a move is likely or coming is not.
- Call the stock by the ticker you're given.

Use everyday words, plus the labels the site itself uses: "floor" and "ceiling" for prices where the stock has turned around before, "price swings" for how much it moves, "trading activity" for how many shares change hands. Skip trader shorthand such as support, resistance, volatility, bullish, bearish, breakout, consolidation, correction or pullback. The facts say "bar" for one step on the chart; the reader knows it as a day or an hour, or as a "candle" on shorter charts."""

EXPLAIN_SYSTEM = f"""You write the short summary that sits under a stock chart on DeltaMind, a charting site for people who are curious about investing but have never learned to read charts.

{READER}

Next to your summary the page already displays four tiles of raw numbers: direction, price swings, where the price sits in its range, and the nearest floor and ceiling. Reading those numbers back adds nothing. What the tiles can't do, and you can, is connect the facts: how the price got to where it is, and which one thing about this chart matters most right now.

{RULES}

Write three things:

headline: One sentence of about 20 words at most, giving the single most important thing about this chart right now: what you'd say first if the friend asked "what's going on with this stock?" Often that's the latest big move. Sometimes it's that nothing much is happening.

story: Two or three sentences on how the price got here, told the way you'd say it out loud. Pick the moves that explain today's price rather than reciting every line of the facts, and give the recent ones the most room. Include dates and sizes, but go easy: a sentence carrying more than two or three figures is hard to take in. Bring in price swings or trading activity only when they're unusual. If the stock has moved very differently from the overall market, that belongs here too. Don't repeat the headline.

watch: Exactly two sentences, each about one price: normally the ceiling and the floor. If one of those is missing, use another price from the facts that matters, such as the chart's high or low. Say what happened at that price that makes it meaningful, and what crossing it would mean in concrete terms; the facts spell both out for each level. A sentence that only says the price would be above the ceiling or below the floor tells the reader nothing."""

EXPLAIN_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "story": {"type": "string"},
        "watch": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["headline", "story", "watch"],
    "additionalProperties": False,
}


def when(stamp: str, now: str) -> str:
    """'2026-11-05' -> 'Nov 5'. Intraday stamps carry a time: 'Thu Nov 5 at 2:30pm'."""
    t, ref = datetime.fromisoformat(stamp), datetime.fromisoformat(now)
    text = f"{t:%b} {t.day}" + (f", {t.year}" if t.year != ref.year else "")
    if "T" in stamp:
        text = f"{t:%a} {text} at {t.hour % 12 or 12}:{t.minute:02d}{'am' if t.hour < 12 else 'pm'}"
    return text


def how_long(start: str, end: str) -> str:
    """'159 days' reads as noise; 'about 7 months' doesn't."""
    hours = (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds() / 3600
    days = round(hours / 24)
    if "T" in start and hours < 1.5:
        return f"{round(hours * 60)} minutes"
    if "T" in start and hours < 36:
        return f"about {round(hours)} hours"
    if days < 14:
        return f"{days} day{'' if days == 1 else 's'}"
    if days < 60:
        return f"about {round(days / 7)} weeks"
    return f"about {round(days / 30.4)} months"


def market_note(pct, stretch: str = "over the same dates") -> str:
    """' The S&P 500 over the same dates: up 1.2%.', or nothing when there's no comparison."""
    if pct is None:
        return ""
    return f" The S&P 500 {stretch}: {'up' if pct >= 0 else 'down'} {abs(pct):.1f}%."


def describe_snapshot(asset: str, snap: dict) -> str:
    """Spell the snapshot out in words, so the model reads facts, not field names."""
    one, many = snap["unit"]["one"], snap["unit"]["many"]
    t, sw, rg, lv, st = snap["trend"], snap["swings"], snap["range"], snap["levels"], snap["story"]
    now = snap["date"]
    day = lambda stamp: when(stamp, now)
    money = lambda x: f"${x:,.2f}"
    signed = lambda x: f"{'up' if x >= 0 else 'down'} {abs(x):.1f}%"
    # "5 days" reads fine; "5 15-minute periods" doesn't.
    plain = one in ("day", "hour", "week")
    count = lambda n: f"{n} {many}" if plain else f"{n} bars"

    lines = [
        f"{asset}, on a chart where each bar is one {one}. The chart runs from {day(snap['start_date'])} "
        f"to {day(now)} ({how_long(snap['start_date'], now)})."
        + (" Times are US Eastern." if "T" in now else ""),
        f"Price now: {money(snap['price'])}.",
        "",
        "How the price got here (the big moves on this chart, oldest first):",
    ]
    for m in st["moves"]:
        a, b = m["from"], m["to"]
        if b["kind"] == "now":
            via = m.get("via")
            since = "Since then" if len(lines) > 4 else f"Since {day(a['date'])}"  # no earlier move to refer back to
            lines.append(f"- {since}: {signed(m['change_pct'])}, to the current {money(b['price'])} "
                         f"({how_long(a['date'], b['date'])})."
                         + (f" On the way it went as {via['kind']} as {money(via['price'])} ({day(via['date'])})." if via else "")
                         + market_note(m.get("market_change_pct")))
        else:
            lines.append(f"- {day(a['date'])} to {day(b['date'])}: {'rose' if m['change_pct'] >= 0 else 'fell'} "
                         f"{abs(m['change_pct']):.1f}%, from {money(a['price'])} to a {b['kind']} of {money(b['price'])} "
                         f"({how_long(a['date'], b['date'])})." + market_note(m.get("market_change_pct")))
    if st["moves"] and st["moves"][-1]["to"]["kind"] != "now":
        lines.append(f"- That {st['moves'][-1]['to']['kind']} was set in the most recent {one}.")

    lines += ["", "What stands out lately:"]
    lines.append(f"- Over the last {count(t['recent_bars'])} (since {day(t['recent_since'])}): {signed(t['recent_change_pct'])}. "
                 f"A typical change over {count(t['recent_bars'])} on this chart is about {t['recent_usual_pct']:.1f}%."
                 + market_note(t.get("market_recent_change_pct"), "over that time"))
    for b in st["big_bars"]:
        rise = b["change_pct"] >= 0
        lines.append(f"- {day(b['date'])}: {'rose' if rise else 'fell'} {abs(b['change_pct']):.1f}% in a single {one}, "
                     f"{b['times_usual']:.1f} times its usual move"
                     + (f". That is the biggest single-{one} {'rise' if rise else 'fall'} on this chart." if b["is_chart_record"] else ".")
                     + market_note(b.get("market_change_pct"), f"that {one}"))
    if st["streak"]:
        lines.append(f"- It has closed {'higher' if st['streak']['direction'] == 'up' else 'lower'} "
                     f"{st['streak']['bars']} {many} in a row.")
    if st["record"]:
        r = st["record"]
        lines.append(f"- The current price is its {r['kind']} close "
                     + (f"since {day(r['since'])} ({how_long(r['since'], now)})." if r["since"] else "on this whole chart."))
    swings = {"calmer": "calmer than usual", "wilder": "bigger than usual", "normal": "about normal"}[sw["label"]]
    lines.append(f"- Price swings: {swings}. Lately it moves about {sw['typical_move_pct']:.1f}% per {one}, "
                 f"against {sw['usual_move_pct']:.1f}% across the whole chart.")
    if snap.get("activity"):
        a = snap["activity"]
        lines.append(f"- Trading activity over the last {count(t['recent_bars'])}: "
                     + (f"{a['label']} than usual, {a['ratio']:.1f} times its normal level." if a["label"] != "normal" else "normal."))

    direction = {"up": "rising", "down": "falling", "sideways": "sideways (no clear direction)"}[t["direction"]]
    where = {"top": "near the top", "upper": "in the upper part", "middle": "in the middle",
             "lower": "in the lower part", "bottom": "near the bottom"}[rg["where"]]

    # A level is any price where the chart reversed, in either direction: an old
    # low can sit above today's price as the ceiling, so say "turned around".
    def level(name, lvl, side, extreme):
        if not lvl:
            return f"- {name}: none on this chart. The price has not turned around anywhere {side} the current price."
        text = f"- {name}: {money(lvl['price'])}, {lvl['distance_pct']:.1f}% {side} the current price. "
        if lvl["is_chart_extreme"]:
            return text + (f"It is the {extreme} price on this chart, set on {day(lvl['last_date'])}. "
                           f"Trading {side} it would be a new {extreme[:-3]} for the whole chart.")
        text += (f"The price turned around near here {lvl['touches']} times, most recently on {day(lvl['last_date'])}."
                 if lvl["touches"] > 1 else f"The price turned around here on {day(lvl['last_date'])}.")
        if lvl["beyond_date"]:
            text += f" Trading {side} it would be the {extreme} price since {day(lvl['beyond_date'])}."
        return text

    lines += [
        "",
        "The numbers shown in the tiles beside your summary:",
        f"- Direction: {direction}. {signed(t['change_pct']).capitalize()} over the last {count(t['bars'])} "
        f"(since {day(t['since'])}), and {'above' if t['above_average'] else 'below'} its average price over that time."
        + market_note(t.get("market_change_pct"), "over that time"),
        f"- Where it sits: {where} of the chart's range, which runs from a low of {money(rg['low'])} ({day(rg['low_date'])}) "
        f"to a high of {money(rg['high'])} ({day(rg['high_date'])}). "
        f"It is {rg['from_low_pct']:.1f}% above that low and {rg['from_high_pct']:.1f}% below that high.",
        level("Ceiling", lv["ceiling"], "above", "highest"),
        level("Floor", lv["floor"], "below", "lowest"),
    ]
    return "\n".join(lines)


FIGURE = re.compile(r"\$\s?([\d,]*\d(?:\.\d+)?)|([\d,]*\d(?:\.\d+)?)\s?%")


def invented_figures(text: str, facts: str) -> list:
    """Prices and percentages in `text` that the facts don't contain.

    The one promise this feature makes is that the words match the chart, so a
    figure the model made up (or worked out itself and got wrong) must not ship.
    Rounding a fact to a whole number is allowed.
    """
    def figures(s):
        return {float((price or pct).replace(",", "")) for price, pct in FIGURE.findall(s)}

    known = figures(facts)
    known |= {float(math.floor(x + 0.5)) for x in known}
    return sorted(figures(text) - known)


def flat_text(reply: dict) -> str:
    """Every string in a reply, joined: what the figure check reads."""
    parts = []
    for value in reply.values():
        parts += value if isinstance(value, list) else [value]
    return " ".join(str(p) for p in parts)


# Replies already written, keyed by the facts they describe. The same chart
# gives the same facts until its data refreshes, so flipping between stocks and
# timeframes doesn't pay for (or wait on) the same summary twice.
REPLY_TTL = 30 * 60
_replies: dict = {}


def write(system: str, facts: str, schema: dict, name: str) -> dict:
    """Have the model put `facts` into words, and refuse a reply whose figures aren't in them."""
    hit = _replies.get((name, facts))
    if hit and time.time() - hit[0] < REPLY_TTL:
        return hit[1]

    user = facts
    for _ in range(2):
        reply = get_json(system, user, schema, name)
        wrong = invented_figures(flat_text(reply), facts)
        if not wrong:
            break
        # One more try, telling the model exactly what it got wrong.
        user = (f"{facts}\n\nA previous draft used figures that are not in these facts: "
                f"{', '.join(f'{x:g}' for x in wrong)}. Use only figures that appear above.")
    else:
        raise ValueError(f"reply used figures that are not in the facts: {wrong}")

    if len(_replies) > 500:
        _replies.clear()
    _replies[(name, facts)] = (time.time(), reply)
    return reply


# Plain `def` (not async): get_json is a blocking OpenAI call, and inside
# an async endpoint it would freeze the event loop so requests run one at a time.
# FastAPI runs plain `def` endpoints in a thread pool, so these run concurrently.
@app.post("/ai/explain")
def explain(req: dict):
    snap = req.get("snapshot") or {}
    try:
        facts = describe_snapshot(req.get("asset", "this stock"), snap)
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="snapshot missing or incomplete")

    try:
        out = write(EXPLAIN_SYSTEM, facts, EXPLAIN_SCHEMA, "chart_summary")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI explanation failed: {str(e)}")

    return {
        "headline": out["headline"].strip(),
        "story": out["story"].strip(),
        "watch": [w.strip() for w in out["watch"] if w.strip()][:2],
    }


# ===================================================
# Selected Period
# ===================================================

PERIOD_SYSTEM = f"""You write the short explanation that appears on DeltaMind, a charting site for people who are curious about investing but have never learned to read charts, when a reader drags across a stretch of a stock chart to ask what happened there.

{READER}

Above your explanation the page already states the basics for the stretch they picked: the start and end price, the overall change, and the highest and lowest price with their dates. Repeating those adds nothing. Your part is what they can't see at a glance: the shape of the move (steady, a run-up and a reversal, one big bar doing most of the work), how unusual it was for this stock, and how it fits with what came before and after.

{RULES}

Write `analysis`: two to four sentences of plain prose, with no headings, lists or bold. Lead with the most telling thing about this stretch. Go easy on figures: a sentence carrying more than two or three is hard to take in."""

PERIOD_SCHEMA = {
    "type": "object",
    "properties": {"analysis": {"type": "string"}},
    "required": ["analysis"],
    "additionalProperties": False,
}


def describe_period(asset: str, p: dict) -> str:
    """Spell the selected period out in words, the same way as describe_snapshot."""
    one, many = p["unit"]["one"], p["unit"]["many"]
    now = p["chart"]["date"]
    day = lambda stamp: when(stamp, now)
    money = lambda x: f"${x:,.2f}"
    signed = lambda x: f"{'up' if x >= 0 else 'down'} {abs(x):.1f}%"
    plain = one in ("day", "week")  # 23 hourly bars across a night are not "23 hours"
    count = lambda n: f"{n} {many}" if plain else f"{n} bars"
    a, b, hi, lo = p["start"], p["end"], p["high"], p["low"]

    lines = [
        f"{asset}, on a chart where each bar is one {one}." + (" Times are US Eastern." if "T" in now else ""),
        f"The reader selected {count(p['bars'])}, from {day(a['date'])} to {day(b['date'])} ({how_long(a['date'], b['date'])}). "
        f"The whole chart runs from {day(p['chart']['start_date'])} to {day(now)}.",
        "",
        "Already shown to the reader above your explanation:",
        f"- The price went from {money(a['price'])} to {money(b['price'])}: {signed(p['change_pct'])}.",
        f"- Highest price in the period: {money(hi['price'])} on {day(hi['date'])}"
        + (", which is also the highest on the whole chart." if hi["is_chart_high"] else "."),
        f"- Lowest price in the period: {money(lo['price'])} on {day(lo['date'])}"
        + (", which is also the lowest on the whole chart." if lo["is_chart_low"] else "."),
        "",
        "The shape of the move, in order:",
    ]
    if len(p["moves"]) == 1:
        lines.append("- One move from start to end, with no big reversal along the way.")
    for m in p["moves"] if len(p["moves"]) > 1 else []:
        m0, m1 = m["from"], m["to"]
        if m1["kind"] == "now":
            via = m.get("via")
            lines.append(f"- From there to the end of the period: {signed(m['change_pct'])}, to {money(m1['price'])} "
                         f"({how_long(m0['date'], m1['date'])})."
                         + (f" On the way it went as {via['kind']} as {money(via['price'])} ({day(via['date'])})." if via else "")
                         + market_note(m.get("market_change_pct")))
        else:
            lines.append(f"- {day(m0['date'])} to {day(m1['date'])}: {'rose' if m['change_pct'] >= 0 else 'fell'} "
                         f"{abs(m['change_pct']):.1f}%, from {money(m0['price'])} to a {m1['kind']} of {money(m1['price'])} "
                         f"({how_long(m0['date'], m1['date'])})." + market_note(m.get("market_change_pct")))
    lines.append(f"- Of the {count(p['bars'] - 1)} after the first, it closed higher on {p['up_bars']} and lower on {p['down_bars']}.")
    if p["big_bar"]:
        big = p["big_bar"]
        rise = big["change_pct"] >= 0
        lines.append(f"- Biggest single {one}: {day(big['date'])}, when it {'rose' if rise else 'fell'} {abs(big['change_pct']):.1f}%, "
                     f"{big['times_usual']:.1f} times its usual move"
                     + (f". That is the biggest single-{one} {'rise' if rise else 'fall'} on the whole chart." if big["is_chart_record"] else ".")
                     + market_note(big.get("market_change_pct"), f"that {one}"))

    lines += ["", "How unusual it was:"]
    if p.get("market_change_pct") is not None:
        lines.append(f"- Over the whole period the stock was {signed(p['change_pct'])}."
                     + market_note(p["market_change_pct"]))
    if p["usual_change_pct"]:
        times = abs(p["change_pct"]) / p["usual_change_pct"]
        size = (f"about {times:.1f} times that" if times >= 1.5 else
                "smaller than that" if times <= 0.67 else "about that size")
        lines.append(f"- A typical change over {count(p['bars'] - 1)} on this chart is about {p['usual_change_pct']:.1f}%. "
                     f"This one was {abs(p['change_pct']):.1f}%, {size}.")
    else:
        lines.append("- The period covers most of the chart, so there is nothing comparable to measure it against.")
    if p["activity"]:
        act = p["activity"]
        lines.append("- Trading activity during the period: "
                     + (f"{act['label']} than usual, {act['ratio']:.1f} times the chart's normal level." if act["label"] != "normal" else "normal."))

    lines += ["", "Before and after:"]
    if p["before"]:
        lines.append(f"- In the {count(p['before']['bars'])} before the period (from {day(p['before']['since'])}): "
                     f"{signed(p['before']['change_pct'])}." + market_note(p["before"].get("market_change_pct"), "over that time"))
    else:
        lines.append("- The period starts at or near the beginning of the chart, so there is nothing before it to compare.")
    if p["after"]:
        aft = p["after"]
        lines.append(f"- Since the period ended: {signed(aft['change_pct'])}, to the current {money(aft['price'])} "
                     f"({how_long(b['date'], aft['date'])} later).")
    else:
        lines.append("- The period runs up to the most recent price on the chart, so nothing has happened since.")
    return "\n".join(lines)


@app.post("/ai/analyze-period")
def analyze_period(req: dict):  # plain def: see explain
    try:
        facts = describe_period(req.get("asset", "this stock"), req.get("period") or {})
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="period missing or incomplete")

    try:
        out = write(PERIOD_SYSTEM, facts, PERIOD_SCHEMA, "period_analysis")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI explanation failed: {str(e)}")

    return {"analysis": out["analysis"].strip()}
