# Chart facts

DeltaMind's written explanations never come straight from an AI looking at a chart.
The numbers are measured here first, and the AI only puts them into words:

```
candles → facts (this folder) → AI service words them → website
```

That split is what keeps the text honest. The website shows the same numbers the
AI was given, and the AI service rejects any reply containing a price or
percentage that isn't in the facts.

## What's here

**`snapshot.py`** — the facts behind "DeltaMind's take" under the chart. Sent with
every `/market/ohlc` response as `snapshot`.

- The four tiles: direction, price swings, where the price sits in the chart's
  range, and the nearest floor and ceiling.
- The story (`snapshot.story`): the big moves that led to the current price, with
  dates; whether this is the highest or lowest close in a while; single bars that
  moved far more than usual; streaks.

**`period.py`** — the facts about a stretch of the chart the reader dragged across
("Explain a period"): the shape of the move, how unusual it was for this stock,
and what came before and after.

## Ground rules

- Everything is measured against the stock's own behavior on the chart, not fixed
  thresholds, so the same rules work for a calm ETF and a wild stock, daily or 15m.
- Facts only. Nothing here predicts, scores or recommends.
- On intraday charts, thin extended-hours bars don't count when measuring price
  swings or looking for turning points.
- Dates and times are US Eastern.
