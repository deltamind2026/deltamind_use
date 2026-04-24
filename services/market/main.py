# services/market/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from dotenv import load_dotenv
import asyncio
from typing import Dict, List, Tuple
from cache import get_cached_data, set_cached_data


load_dotenv()

# ---------------- Data Sources ----------------
from mock import mock_ohlc, mock_chain
from adapters.deribit import fetch_chain as deribit_chain
from adapters.tradier import fetch_chain as tradier_chain
from adapters.polygon import fetch_ohlc as polygon_ohlc

# ---------------- Intelligence ----------------
from metrics.market_state import build_market_state
from metrics.multi_timeframe import combine_timeframes


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


def safe_market_state(candles: List[Dict]) -> Dict:
    """Metrics engine must never crash UI"""
    try:
        if not candles:
            return {"error": "no_data"}
        return build_market_state(candles)
    except Exception as e:
        return {"error": f"market_state_failed: {str(e)}"}


# ---------------------------------------------------
# Health
# ---------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "service": "market", "version": "5.4"}


# ---------------------------------------------------
# OHLC + Market State
# ---------------------------------------------------

@app.get("/market/ohlc")
async def ohlc(symbol: str, tf: str = "1d", limit: int = 220):
    cached = get_cached_data(symbol, tf)
    if cached:
        cached['cache_hit'] = True
        return JSONResponse(cached, headers={"Cache-Control": "public, max-age=900"})
    
    tf = tf.lower()
    if tf not in VALID_TF:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe {tf}")
    
    raw, provider = await safe_polygon(symbol, tf, limit)
    candles = normalize_candles(raw)
    market_state = safe_market_state(candles)
    
    response_data = {
        "symbol": symbol.upper(),
        "timeframe": tf,
        "provider": provider,
        "candles": candles,
        "market_state": market_state,
        "cache_hit": False
    }
    
    set_cached_data(symbol, tf, response_data)
    
    return JSONResponse(response_data, headers={"Cache-Control": "public, max-age=900"})

# ---------------------------------------------------
# Multi-Timeframe Intelligence
# ---------------------------------------------------

@app.get("/market/multi")
async def multi_timeframe(symbol: str):

    timeframes = ["5m", "1h", "1d", "1w"]
    results = {}

    async def fetch_tf(tf: str):
        raw, provider = await safe_polygon(symbol, tf, 220)
        candles = normalize_candles(raw)
        state = safe_market_state(candles)
        return tf, state

    completed = await asyncio.gather(*(fetch_tf(tf) for tf in timeframes))

    for tf, state in completed:
        results[tf] = state

    # combine higher-level intelligence
    try:
        combined = combine_timeframes(results)
    except Exception as e:
        combined = {"error": f"combine_failed: {str(e)}"}

    return {
        "symbol": symbol.upper(),
        "timeframes": results,
        "combined": combined
    }


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

@app.post("/ai/explain")
async def ai_explain_endpoint(request: dict):
    import os
    import httpx
    
    ai_url = os.getenv("AI_ORCHESTRATOR_URL")
    #ai_url = "http://localhost:8002"
    
    if not ai_url:
        raise HTTPException(
            status_code=500,
            detail="AI_ORCHESTRATOR_URL not configured"
        )
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{ai_url}/ai/explain",
                json=request
            )
            return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}"
        )
    
@app.post("/ai/analyze-period")
async def ai_analyze_period(request: dict):
    import os
    import httpx
    
    ai_url = os.getenv("AI_ORCHESTRATOR_URL")
    
    if not ai_url:
        raise HTTPException(
            status_code=500,
            detail="AI_ORCHESTRATOR_URL not configured"
        )
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{ai_url}/ai/analyze-period",
                json=request
            )
            return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}"
        )

@app.post("/ai/hover")
async def ai_hover_endpoint(request: dict):
    """
    Provide real-time hover analysis for individual candles.
    """
    import os
    import httpx
    
    ai_url = os.getenv("AI_ORCHESTRATOR_URL")
    
    if not ai_url:
        raise HTTPException(
            status_code=500,
            detail="AI_ORCHESTRATOR_URL not configured"
        )
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{ai_url}/ai/hover",
                json=request
            )
            return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}"
        )
