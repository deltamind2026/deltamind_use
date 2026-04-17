# services/ai-orchestrator/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from intelligence_builder import build_chart_intel
from openai_client import get_completion

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

@app.post("/ai/explain")
async def explain_structured(req: dict):
    try:
        chart_intel = build_chart_intel(
            asset=req.get("asset"),
            timeframe=req.get("timeframe"),
            candles=req.get("candles", []),
            market_state=req.get("market_state", {}),
            indicators=req.get("indicators", {}),
            levels=req.get("levels", {}),
        )

        explanation = get_completion(chart_intel)

        return {"explanation": explanation}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI explanation failed: {str(e)}"
        )


# ===================================================
# Dev / Testing Endpoint (Flexible Payload)
# ===================================================

@app.post("/ai/explain")
async def explain_structured(req: dict):
    try:
        chart_intel = build_chart_intel(
            asset=req.get("asset"),
            timeframe=req.get("timeframe"),
            candles=req.get("candles", []),
            market_state=req.get("market_state", {}),
            indicators=req.get("indicators", {}),
            levels=req.get("levels", {}),
        )

        # Convert the structured intelligence into a text prompt
        prompt = f"""Analyze {chart_intel.get('asset')} stock for a beginner investor.

Current Price: ${chart_intel.get('current_price', 0):.2f}
Timeframe: {chart_intel.get('timeframe')}

Market Behavior:
{chart_intel.get('market_behavior', {})}

Last Candle:
{chart_intel.get('last_candle', {})}

Trading Decision Context:
{chart_intel.get('decision', {})}

Instructions: {chart_intel.get('instruction', 'Provide clear, beginner-friendly analysis.')}

Provide a beginner-friendly analysis in 4 sections:
1. What the Market is Doing (2-3 sentences)
2. Why This Matters (2-3 sentences)
3. What Could Change (2-3 sentences)  
4. Risk Awareness (2-3 sentences)

Keep it simple and avoid jargon."""

        explanation = get_completion(prompt, max_tokens=400)

        return {"explanation": explanation}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI explanation failed: {str(e)}"
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


@app.post("/ai/analyze-period")
async def analyze_time_period(req: dict):
    from openai_client import get_completion
    
    symbol = req.get("symbol", "Unknown")
    start_date = req.get("start_date", "")
    end_date = req.get("end_date", "")
    start_price = req.get("start_price", 0)
    end_price = req.get("end_price", 0)
    price_change = req.get("price_change_pct", 0)
    candles = req.get("candles", [])
    
    if not candles or len(candles) < 2:
        return {"analysis": "Not enough data in this time window."}
    
    # Calculate statistics
    highs = [c.get("high", 0) for c in candles]
    lows = [c.get("low", 0) for c in candles]
    volumes = [c.get("volume", 0) for c in candles]
    
    period_high = max(highs) if highs else 0
    period_low = min(lows) if lows else 0
    avg_volume = sum(volumes) / len(volumes) if volumes else 0
    
    # Determine trend
    if price_change > 5:
        trend = "strong upward movement"
    elif price_change > 2:
        trend = "moderate upward movement"
    elif price_change < -5:
        trend = "strong downward movement"
    elif price_change < -2:
        trend = "moderate downward movement"
    else:
        trend = "sideways movement (consolidation)"
    
    prompt = f"""You are analyzing a specific time period for a stock for someone learning to invest.

**Time Period:** {start_date} to {end_date}
**Stock:** {symbol}
**What Happened:**
- Starting price: ${start_price:.2f}
- Ending price: ${end_price:.2f}
- Change: {price_change:+.2f}%
- Highest point: ${period_high:.2f}
- Lowest point: ${period_low:.2f}
- Number of days: {len(candles)}
- Pattern: {trend}

Provide a beginner-friendly analysis in 3 sections:

**1. What Happened** (2-3 sentences)
Describe the price movement in plain English. Did it go up, down, or sideways? How much? Was it smooth or volatile?

**2. Why This Matters** (2-3 sentences)
Explain what this movement tells us. Did the stock break through a key level? Did it bounce off support? What does this suggest about buyer/seller control?

**3. What to Watch Next** (3-4 actionable items)
Based on this period, what should someone watch for? What price levels matter? What would signal continuation vs reversal?

Keep it simple, avoid jargon, and be specific with prices and percentages."""

    try:
        completion = get_completion(prompt)
        return {"analysis": completion}
    except Exception as e:
        return {"analysis": f"Analysis failed: {str(e)}"}