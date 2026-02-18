# services/ai-orchestrator/openai_client.py

import os
from dotenv import dotenv_values
from openai import OpenAI

config = dotenv_values(".env")
client = OpenAI(api_key=config.get("OPENAI_API_KEY"))

# =========================================================
# SYSTEM PROMPTS
# =========================================================

BEGINNER_SYSTEM_PROMPT = """
You are DeltaMind — a patient trading mentor.

You teach beginners how markets behave.

You DO NOT:
- predict price
- give financial advice
- tell users to buy or sell

You DO:
- explain behavior
- explain risk
- explain trader psychology
- explain what could change the situation

Tone:
Calm, simple, educational.
Use analogies when helpful.
Avoid jargon whenever possible.

Always structure explanation:

1) What the market is doing
2) Why traders care
3) What could change
4) Risk awareness
"""

PRO_SYSTEM_PROMPT = """
You are DeltaMind — a professional market behavior analyst.

You analyze structured trading intelligence.

You DO NOT:
- predict price
- generate signals
- give financial advice

You DO:
- explain participation
- describe positioning
- describe risk
- describe invalidation conditions

Tone:
Concise, professional, trading desk style.
No fluff. No analogies. No hype.
"""

# =========================================================
# PROMPT BUILDER
# =========================================================

def build_user_prompt(chart_intel: dict, mode: str = "beginner") -> str:
    """
    Convert structured intelligence into a clean LLM request
    """

    asset = chart_intel.get("asset")
    tf = chart_intel.get("timeframe")
    price = chart_intel.get("current_price")

    behavior = chart_intel.get("market_behavior", {})
    candle = chart_intel.get("last_candle", {})
    levels = chart_intel.get("key_levels", {})
    multi = chart_intel.get("multi_timeframe", {})
    decision = chart_intel.get("decision", {})

    if mode == "pro":
        instruction = "Provide a concise professional market read."
    else:
        instruction = "Explain this to someone learning how markets work."

    return f"""
Asset: {asset}
Timeframe: {tf}
Current Price: {price}

Market Behavior:
{behavior}

Last Candle:
{candle}

Key Levels:
{levels}

Multi-Timeframe Context:
{multi}

Trader Decision Context:
{decision}

Instruction:
{instruction}

Never predict price.
Never tell user to buy or sell.
Explain only the provided data.
"""


# =========================================================
# MAIN EXPLANATION FUNCTION
# =========================================================

def explain_chart(chart_intel: dict, mode: str = "beginner") -> str:
    """
    Generate explanation for chart intelligence
    mode = "beginner" | "pro"
    """

    if not chart_intel or "error" in chart_intel:
        return "Market data unavailable or incomplete."

    system_prompt = BEGINNER_SYSTEM_PROMPT if mode == "beginner" else PRO_SYSTEM_PROMPT
    user_prompt = build_user_prompt(chart_intel, mode)

    try:
        response = client.chat.completions.create(
            model="gpt-5-mini",   # fast, cheap, strong reasoning
            temperature=0.25,     # low hallucination
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        text = response.choices[0].message.content.strip()

        # Safety fallback
        if len(text) < 10:
            return "Unable to interpret current market conditions."

        return text

    except Exception as e:
        return f"AI explanation failed: {str(e)}"

