
DeltaMind v5.2 — Pro Chart Engine + Real Options Chain Adapters (Tradier + Deribit)

What’s new in v5.2
1) Chart engine completion
   - Drawing tools: Trendline + Fibonacci (drag-to-draw) via Canvas overlay
   - Indicator configurability UI: per-indicator params, toggles, presets
   - Volume Profile real math: volume-by-price bins + POC + value area

2) Real options chain integration
   - Tradier adapter (requires TRADIER_TOKEN)
   - Deribit adapter (public endpoints, no key required for most reads)
   - Normalized options schema returned by /options/chain
   - Mock fallback if provider unavailable

Repo layout
- apps/web            Next.js (chart UX + drawing tools + indicator settings)
- services/market     FastAPI (OHLC + options chain providers)
- services/ai-orchestrator FastAPI (optional; kept minimal)

Quick start (dev)
1) Services
   cd services/market
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8040

2) Web
   cd apps/web
   npm i
   npm run dev
   open http://localhost:3000/dashboard/canvas

Env
- TRADIER_TOKEN=...            (Tradier bearer token)
- DERIBIT_ENV=prod|test        (default prod)

Notes
- Deribit is best for crypto options (BTC/ETH).
- Tradier is best for US equity/index options (AAPL, NVDA, SPY).
