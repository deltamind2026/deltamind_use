
import random
from datetime import datetime, timedelta

def mock_ohlc(symbol:str, tf:str="1D", limit:int=220):
    now = datetime.utcnow()
    step = {"1D": 24*60, "4H": 4*60, "1H": 60, "15m": 15}.get(tf, 24*60)
    points = []
    price = 500 + random.random()*40
    for i in range(limit):
        t = now - timedelta(minutes=step*(limit-i))
        o = price
        c = max(1, o + random.uniform(-5, 5))
        h = max(o, c) + random.uniform(0, 2)
        l = min(o, c) - random.uniform(0, 2)
        v = random.randint(100000, 900000)
        points.append({"t": t.isoformat()+"Z", "o": round(o,2), "h": round(h,2), "l": round(l,2), "c": round(c,2), "v": v})
        price = c
    return {"symbol": symbol.upper(), "tf": tf, "points": points}

def mock_chain(symbol:str):
    sym = symbol.upper()
    atm = 620 if sym in ("NVDA","SPY","AAPL","TSLA","NFLX","HOOD") else (40000 if sym=="BTC" else 2000)
    rows = []
    exps = ["2026-01-16","2026-02-20"]
    for exp in exps:
        for k in range(int(atm*0.85), int(atm*1.15), int(max(1, atm*0.01))):
            for t in ("call","put"):
                rows.append({
                    "provider":"mock",
                    "symbol": sym,
                    "exp": exp,
                    "type": t,
                    "strike": float(k),
                    "bid": round(random.uniform(0.5, 12), 2),
                    "ask": round(random.uniform(0.6, 12.5), 2),
                    "iv": round(random.uniform(0.25, 0.75), 4),
                    "oi": random.randint(10, 20000),
                })
        break
    return {"provider":"mock","symbol": sym, "rows": rows}
