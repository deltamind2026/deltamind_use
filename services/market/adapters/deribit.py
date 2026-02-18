
import httpx, os
from typing import Any, Dict, List

DERIBIT_ENV = os.getenv("DERIBIT_ENV", "prod")
BASE = "https://www.deribit.com/api/v2" if DERIBIT_ENV == "prod" else "https://test.deribit.com/api/v2"

async def fetch_chain(symbol: str) -> Dict[str, Any]:
    # Deribit is crypto options: use currency BTC/ETH
    currency = symbol.upper()
    if currency not in ("BTC", "ETH"):
        raise ValueError("Deribit adapter supports BTC/ETH symbols.")

    async with httpx.AsyncClient(timeout=20) as client:
        # Get instruments
        r = await client.get(f"{BASE}/public/get_instruments", params={"currency": currency, "kind": "option", "expired": "false"})
        r.raise_for_status()
        instruments = r.json()["result"]

        # Sample a subset for demo (avoid huge payloads)
        instruments = instruments[:250]

        rows: List[Dict[str, Any]] = []
        # Get book summary (includes iv, bid/ask, open_interest)
        # Deribit supports batch via get_book_summary_by_currency
        s = await client.get(f"{BASE}/public/get_book_summary_by_currency", params={"currency": currency, "kind": "option"})
        s.raise_for_status()
        summary = {x["instrument_name"]: x for x in s.json()["result"]}

        for inst in instruments:
            name = inst["instrument_name"]
            kind = inst["option_type"]  # 'call'|'put'
            strike = float(inst["strike"])
            exp_ms = int(inst["expiration_timestamp"])
            exp = __ms_to_iso(exp_ms)

            sm = summary.get(name, {})
            rows.append({
                "provider": "deribit",
                "symbol": currency,
                "exp": exp,
                "type": "call" if kind == "call" else "put",
                "strike": strike,
                "bid": sm.get("bid_price"),
                "ask": sm.get("ask_price"),
                "iv": sm.get("iv"),
                "oi": sm.get("open_interest"),
            })
        return {"provider":"deribit", "symbol": currency, "rows": rows}

def __ms_to_iso(ms: int) -> str:
    import datetime
    return datetime.datetime.utcfromtimestamp(ms/1000).strftime("%Y-%m-%d")
