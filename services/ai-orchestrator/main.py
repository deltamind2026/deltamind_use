# services/ai-orchestrator/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from intelligence_builder import build_chart_intel
from openai_client import explain_chart


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
# Models
# ===================================================

class ExplainRequest(BaseModel):
    asset: str
    timeframe: str
    candles: List[Dict[str, Any]]

    # Primary AI input
    market_state: Optional[Dict[str, Any]] = {}

    # Optional context
    indicators: Optional[Dict[str, Any]] = {}
    levels: Optional[Dict[str, Any]] = {}


class ExplainResponse(BaseModel):
    explanation: str


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
# Full AI Explanation (LLM)
# ===================================================

@app.post("/ai/explain", response_model=ExplainResponse)
async def explain_structured(req: ExplainRequest):
    """
    Main production AI endpoint.
    Uses structured market_state + candles to produce narrative analysis.
    """

    try:
        chart_intel = build_chart_intel(
            asset=req.asset,
            timeframe=req.timeframe,
            candles=req.candles,
            market_state=req.market_state,
            indicators=req.indicators,
            levels=req.levels,
        )

        explanation = explain_chart(chart_intel)

        return {"explanation": explanation}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI explanation failed: {str(e)}"
        )


# ===================================================
# Dev / Testing Endpoint (Flexible Payload)
# ===================================================

@app.post("/explain")
async def explain_raw(data: dict):
    """
    Flexible testing endpoint.
    Accepts raw payloads without strict schema.
    Useful for debugging during development.
    """

    try:
        chart_intel = build_chart_intel(
            asset=data.get("asset"),
            timeframe=data.get("timeframe"),
            candles=data.get("candles"),
            market_state=data.get("market_state"),
            indicators=data.get("indicators"),
            levels=data.get("levels"),
        )

        explanation = explain_chart(chart_intel)

        return {"explanation": explanation}

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Bad payload: {str(e)}"
        )


# ===================================================
# Ultra-Fast Hover Explanation (Realtime Tooltip)
# ===================================================

@app.post("/ai/hover")
async def hover_explain(data: dict):
    """
    Very fast rule-based explanation for crosshair hover.
    No LLM call — instant response.
    """

    try:
        candle = data.get("candle", {})
        state = data.get("market_state", {})

        close = candle.get("close")
        open_ = candle.get("open")

        if close is None or open_ is None:
            return {"text": "No candle data"}

        direction = "bullish" if close > open_ else "bearish"

        regime = state.get("regime", "unknown")
        volatility = state.get("volatility_state", "normal")
        pattern = state.get("pattern", "none")
        ema_trend = state.get("ema_trend", "mixed")

        explanation = (
            f"{direction} candle inside {regime} market. "
            f"Volatility is {volatility}. "
            f"Trend alignment: {ema_trend}. "
            f"Pattern context: {pattern}."
        )

        return {"text": explanation}

    except Exception:
        return {"text": "Unable to analyze candle"}

