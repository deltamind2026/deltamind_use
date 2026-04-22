from typing import Dict, Any, List


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def confidence_score(state: Dict[str, Any], multi: Dict[str, Any]) -> float:
    score = 0.5

    if state.get("trend_strength") == "strong":
        score += 0.15

    if multi.get("alignment") == "aligned":
        score += 0.2
    elif multi.get("conflict"):
        score -= 0.2

    if state.get("volatility_state") == "expanding":
        score += 0.05

    return round(max(0.1, min(score, 0.95)), 2)


def classify_condition(state: Dict[str, Any]) -> str:
    regime = state.get("regime")
    volatility = state.get("volatility_state")
    structure = state.get("structure")

    if regime == "trend" and structure == "pullback":
        return "trend_pullback"

    if regime == "trend" and volatility == "expanding":
        return "trend_expansion"

    if regime == "range":
        return "range_rotation"

    return "unclear"


# -------------------------------------------------------
# Scenario Builder
# -------------------------------------------------------

def build_scenarios(condition: str, state: Dict[str, Any]) -> List[Dict[str, Any]]:
    scenarios = []

    if condition == "trend_pullback":
        scenarios.append({
            "name": "trend_continuation",
            "if": "price holds support",
            "then": "trend traders participate",
            "risk": "moderate",
            "invalidates": "structure breakdown"
        })

        scenarios.append({
            "name": "failed_pullback",
            "if": "support breaks",
            "then": "fast move opposite direction possible",
            "risk": "high",
            "invalidates": "recovery back above level"
        })

    elif condition == "range_rotation":
        scenarios.append({
            "name": "mean_reversion",
            "if": "price reaches extremes",
            "then": "rotation likely",
            "risk": "low",
            "invalidates": "range breakout"
        })

    else:
        scenarios.append({
            "name": "no_edge",
            "if": "conditions unclear",
            "then": "observation preferred",
            "risk": "unknown",
            "invalidates": "clear structure forms"
        })

    return scenarios


# -------------------------------------------------------
# Trader Guidance
# -------------------------------------------------------

def trader_guidance(condition: str) -> Dict[str, str]:

    if condition == "trend_pullback":
        return {
            "scalper": "wait for reaction confirmation",
            "swing": "favorable location if structure holds",
            "investor": "minor timeframe noise"
        }

    if condition == "range_rotation":
        return {
            "scalper": "fade extremes",
            "swing": "reduce size",
            "investor": "avoid decision"
        }

    return {
        "scalper": "no clear setup",
        "swing": "no edge",
        "investor": "ignore"
    }


# -------------------------------------------------------
# Main Decision Engine

