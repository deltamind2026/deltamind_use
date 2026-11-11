# services/market/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from dotenv import load_dotenv
import asyncio
import os
from typing import Dict, List, Tuple
from cache import get_cached_data, set_cached_data


load_dotenv()

# ---------------- Data Sources ----------------
from mock import mock_ohlc, mock_chain
from adapters.deribit import fetch_chain as deribit_chain
from adapters.tradier import fetch_chain as tradier_chain
from adapters.polygon import fetch_ohlc as polygon_ohlc

# ---------------- Intelligence ----------------
from metrics.snapshot import build_snapshot
from metrics.period import build_period


# ---------------------------------------------------
# App
# ---------------------------------------------------

app = FastAPI(title="DeltaMind Market Service (v5.4 stable)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_TF = {"5m", "15m", "1h", "4h", "1d", "1w"}

# "The overall market" that every stock is compared against: the S&P 500, through
# the fund that tracks it. One chart per timeframe, shared by every stock.
BENCHMARK = "SPY"
CHART_BARS = 220  # how many candles a chart loads


# ---------------------------------------------------
# Helpers
# ---------------------------------------------------

def normalize_candles(raw: List[Dict]) -> List[Dict]:
    """Convert provider candles into canonical format"""
    candles = []
    for c in raw:
        try:
            candles.append({
                "time": c.get("time") or c.get("t"),
                "open": float(c.get("open") or c.get("o")),
                "high": float(c.get("high") or c.get("h")),
                "low": float(c.get("low") or c.get("l")),
                "close": float(c.get("close") or c.get("c")),
                "volume": float(c.get("volume") or c.get("v", 0)),
            })
        except Exception:
            continue
    return candles


async def safe_polygon(symbol: str, tf: str, limit: int) -> Tuple[List[Dict], str]:
    """Polygon wrapper that never crashes"""
    try:
        raw = await polygon_ohlc(symbol, tf=tf, limit=limit)
        return raw, "polygon"
    except Exception as e:
        #return mock_ohlc(symbol, tf=tf, limit=limit)
        mock_payload = mock_ohlc(symbol, tf=tf, limit=limit)
        return mock_payload.get("points", []), f"mock_polygon_error({str(e)[:40]})"


def safe_snapshot(candles: List[Dict], tf: str, market: List[Dict] = None) -> Dict:
    try:
        return build_snapshot(candles, tf, market)
    except Exception as e:
        return {"error": f"snapshot_failed: {str(e)}"}


async def load_chart(symbol: str, tf: str, limit: int) -> Dict:
    """Candles plus snapshot for one stock, from the cache when it's fresh."""
    # `limit` is part of the key: the "Add stock" check asks for a single candle,
    # and that one-candle answer must not be served back as the stock's whole chart.
    cache_tf = f"{tf}:{limit}"
    cached = get_cached_data(symbol, cache_tf)
    if cached:
        cached['cache_hit'] = True
        return cached

    # A full chart also loads the market to compare against. Small requests
    # (price lookups, the "Add stock" check) don't need it.
    compare = symbol != BENCHMARK and limit >= 30
    (raw, provider), market = await asyncio.gather(
        safe_polygon(symbol, tf, limit),
        market_candles(tf) if compare else asyncio.sleep(0),
    )
    candles = normalize_candles(raw)
    live = provider == "polygon"

    # Never set made-up prices against the real market.
    snapshot = safe_snapshot(candles, tf, market if live else None)
    # Made-up prices (no API key, or the data provider turned us away). The
    # website says so next to the summary instead of presenting them as real.
    snapshot["sample_data"] = not live

    chart = {
        "symbol": symbol,
        "timeframe": tf,
        "provider": provider,
        "candles": candles,
        "snapshot": snapshot,
        "cache_hit": False
    }
    # Only real data is worth keeping. Caching the fallback would pin fake
    # prices to this stock for 15 minutes after one failed request.
    if live:
        set_cached_data(symbol, cache_tf, chart)
    return chart


async def market_candles(tf: str):
    """The benchmark's candles on this timeframe, or None if only made-up data is available."""
    chart = await load_chart(BENCHMARK, tf, CHART_BARS)
    return chart["candles"] if chart["provider"] == "polygon" else None


# ---------------------------------------------------
# Health
# ---------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "service": "market", "version": "5.4"}


# ---------------------------------------------------
# OHLC + Snapshot
# ---------------------------------------------------

@app.get("/market/ohlc")
async def ohlc(symbol: str, tf: str = "1d", limit: int = CHART_BARS):
    symbol = symbol.upper()
    tf = tf.lower()
    if tf not in VALID_TF:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe {tf}")

    chart = await load_chart(symbol, tf, limit)
    live = chart["provider"] == "polygon"
    return JSONResponse(chart, headers={"Cache-Control": "public, max-age=900" if live else "no-store"})

# ---------------------------------------------------
# Options Chain
# ---------------------------------------------------

@app.get("/options/chain")
async def options_chain(symbol: str, provider: str = "tradier"):

    provider = provider.lower()

    try:
        if provider == "tradier":
            data = await tradier_chain(symbol)

        elif provider == "deribit":
            data = await deribit_chain(symbol)

        elif provider == "mock":
            data = mock_chain(symbol)

        else:
            raise HTTPException(status_code=400, detail="provider must be tradier|deribit|mock")

    except Exception as e:
        # safe fallback for UI demos
        if provider != "mock":
            data = mock_chain(symbol)
            data["provider"] = f"mock_fallback({provider})"
            data["warning"] = str(e)
        else:
            raise HTTPException(status_code=500, detail=str(e))

    rows = []
    for r in data.get("rows", []):
        rows.append({
            "exp": r.get("exp"),
            "type": r.get("type"),
            "strike": r.get("strike"),
            "bid": r.get("bid"),
            "ask": r.get("ask"),
            "iv": r.get("iv"),
            "oi": r.get("oi"),
        })

    return {
        "symbol": data.get("symbol", symbol.upper()),
        "provider": data.get("provider", provider),
        "rows": rows,
        "warning": data.get("warning"),
    }

async def _wake_orchestrator(client: httpx.AsyncClient, ai_url: str, max_wait: float = 55.0) -> bool:
    """Render free services sleep when idle. Poll the health route until the
    AI service answers, so the first user request does not fail while it starts."""
    loop = asyncio.get_event_loop()
    deadline = loop.time() + max_wait
    while True:
        try:
            r = await client.get(f"{ai_url}/ai/hello", timeout=10.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        if loop.time() >= deadline:
            return False
        await asyncio.sleep(3)


async def _post_to_orchestrator(path: str, payload: dict, timeout: float = 60.0):
    ai_url = os.getenv("AI_ORCHESTRATOR_URL")
    if not ai_url:
        raise HTTPException(status_code=500, detail="AI_ORCHESTRATOR_URL not configured")
    ai_url = ai_url.rstrip("/")

    async with httpx.AsyncClient(timeout=timeout) as client:
        if not await _wake_orchestrator(client, ai_url):
            # 503 tells the website the service is still starting, so it retries.
            raise HTTPException(status_code=503, detail="AI service is starting up. Please try again in a moment.")
        try:
            response = await client.post(f"{ai_url}{path}", json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@app.get("/ai/warmup")
async def ai_warmup():
    """Called when the site loads so a sleeping AI service starts early."""
    ai_url = (os.getenv("AI_ORCHESTRATOR_URL") or "").rstrip("/")
    if ai_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.get(f"{ai_url}/ai/hello")
        except Exception:
            pass  # the request itself is what wakes the service
    return {"ok": True}


@app.post("/ai/explain")
async def ai_explain_endpoint(request: dict):
    return await _post_to_orchestrator("/ai/explain", request)


@app.post("/ai/analyze-period")
async def ai_analyze_period(request: dict):
    """The website sends the chart it is showing and which bars were selected.
    The facts about that stretch are measured here; the AI service words them."""
    sent = request.get("candles") or []
    candles = normalize_candles(sent)
    try:
        if len(candles) != len(sent):
            raise ValueError("unreadable candles")  # positions would no longer line up
        symbol = str(request.get("symbol", "")).upper()
        tf = str(request.get("timeframe", "1d")).lower()

        # Compare with the market only if these are the real candles we served
        # for this chart (made-up data is never cached, so it never matches).
        market = None
        ours = get_cached_data(symbol, f"{tf}:{CHART_BARS}")
        if symbol != BENCHMARK and ours and ours["candles"][-1]["time"] == candles[-1]["time"]:
            market = await market_candles(tf)

        period = build_period(candles, tf, int(request["start"]), int(request["end"]), market)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad period request: {str(e)}")
    if "error" in period:
        raise HTTPException(status_code=400, detail=period["error"])

    return await _post_to_orchestrator(
        "/ai/analyze-period", {"asset": request.get("symbol", "this stock"), "period": period}
    )
