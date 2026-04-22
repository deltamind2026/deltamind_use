
import httpx, os
from typing import Any, Dict, List, Optional

TRADIER_TOKEN = os.getenv("TRADIER_TOKEN")
BASE = os.getenv("TRADIER_BASE", "https://api.tradier.com/v1")

async def fetch_chain(symbol: str) -> Dict[str, Any]:
    if not TRADIER_TOKEN:
        raise RuntimeError("TRADIER_TOKEN is not set.")

    sym = symbol.upper()
    headers = {"Authorization": f"Bearer {TRADIER_TOKEN}", "Accept": "application/json"}

    async with httpx.AsyncClient(timeout=25, headers=headers) as client:
        # 1) get option expirations
        ex = await client.get(f"{BASE}/markets/options/expirations", params={"symbol": sym, "includeAllRoots": "true", "strikes": "false"})
        ex.raise_for_status()
        expirations = ex.json().get("expirations", {}).get("date", [])

        expirations = expirations[:6]  # limit for demo

        rows: List[Dict[str, Any]] = []
        for exp in expirations:
            ch = await client.get(f"{BASE}/markets/options/chains", params={"symbol": sym, "expiration": exp, "greeks": "true"})
            ch.raise_for_status()
            opts = ch.json().get("options", {}).get("option", [])
            for o in opts:
                # Tradier returns 'option_type': 'call'|'put'
                rows.append({
                    "provider":"tradier",
                    "symbol": sym,
                    "exp": exp,
                    "type": o.get("option_type"),
                    "strike": float(o.get("strike")),
                    "bid": o.get("bid"),
                    "ask": o.get("ask"),
                    "iv": (o.get("greeks") or {}).get("mid_iv") or (o.get("greeks") or {}).get("smv_vol"),
                    "oi": o.get("open_interest"),
                    "delta": (o.get("greeks") or {}).get("delta"),
                    "gamma": (o.get("greeks") or {}).get("gamma"),
                    "theta": (o.get("greeks") or {}).get("theta"),
                    "vega": (o.get("greeks") or {}).get("vega"),
                })
        return {"provider":"tradier", "symbol": sym, "rows": rows}
