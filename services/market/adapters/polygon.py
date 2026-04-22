# services/market/adapters/polygon.py

import os
import httpx
from datetime import datetime, timedelta

POLYGON_KEY = os.getenv("POLYGON_API_KEY")

BASE = "https://api.polygon.io"


async def fetch_ohlc(symbol: str, tf: str = "1D", limit: int = 220):
    """
    Fetch OHLCV from Polygon Aggregates API
    Normalizes into DeltaMind candle format
    """

    if not POLYGON_KEY:
        raise RuntimeError("POLYGON_API_KEY missing")

    multiplier, timespan = _translate_tf(tf)

    end = datetime.utcnow()
    start = end - timedelta(days=_estimate_days(tf, limit))

    url = (
        f"{BASE}/v2/aggs/ticker/{symbol}/range/"
        f"{multiplier}/{timespan}/{start.date()}/{end.date()}"
        f"?adjusted=true&sort=asc&limit=50000&apiKey={POLYGON_KEY}"
    )

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()

    results = data.get("results", [])

    candles = []
    for c in results[-limit:]:
        candles.append({
            "time": datetime.utcfromtimestamp(c["t"] / 1000).isoformat(),
            "open": c["o"],
            "high": c["h"],
            "low": c["l"],
            "close": c["c"],
            "volume": c["v"],
        })

    return candles


# ---------------------------------------------------
# Helpers
# ---------------------------------------------------

def _translate_tf(tf: str):
    tf = tf.lower()

    mapping = {
        "1m": (1, "minute"),
        "5m": (5, "minute"),
        "15m": (15, "minute"),
        "30m": (30, "minute"),
        "1h": (1, "hour"),
        "4h": (4, "hour"),
        "1d": (1, "day"),
    }

    return mapping.get(tf, (1, "day"))


def _estimate_days(tf: str, limit: int):
    if "m" in tf:
        return int(limit / 60 / 6.5 * 2) + 5
    if "h" in tf:
        return int(limit / 6.5) + 5
    return limit + 10

