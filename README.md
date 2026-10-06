# DeltaMind

Charting dashboard with technical indicators, drawing tools, an options chain viewer, and AI chart explanations.

## Repo layout

| Path | What | Port |
| --- | --- | --- |
| `apps/web` | Next.js frontend | 3000 |
| `services/market` | FastAPI: OHLC data, indicators/metrics, options chains | 8040 |
| `services/ai-orchestrator` | FastAPI: AI chart explanations (OpenAI) | 8002 |

## Setup

### 1. API keys

Create `services/market/.env`:

```
POLYGON_API_KEY=...                        # OHLC data (falls back to mock data if missing)
TRADIER_TOKEN=...                          # equity options chains (optional)
AI_ORCHESTRATOR_URL=http://localhost:8002  # required for AI features
```

Create `services/ai-orchestrator/.env`:

```
OPENAI_API_KEY=sk-...                      # required, the orchestrator won't start without it
```

Both `.env` files are gitignored.

### 2. Run (3 terminals)

Commands are for Windows. On macOS/Linux, activate with `source .venv/bin/activate` instead.

**Market service**
```
cd services/market
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8040
```

**AI orchestrator**
```
cd services/ai-orchestrator
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

**Web**
```
cd apps/web
npm install
npm run dev
```

Then open http://localhost:3000.

You only need `python -m venv` and `pip install` the first time.
