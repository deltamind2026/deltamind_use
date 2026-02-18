
# DeltaMind v5.2 — Work Packages (Students)

## WP1 — Drawing Tools (Chart Overlay)
- Files:
  - apps/web/components/DrawingOverlay.tsx
- Tasks:
  - Add hit-testing & selection
  - Add more tools: horizontal ray, rectangle, text, measurement
  - Persist drawings per symbol/timeframe

## WP2 — Indicator Configurator + Presets
- Files:
  - apps/web/components/IndicatorPanel.tsx
  - apps/web/lib/ta/settings.ts
- Tasks:
  - Add presets: "Kid Mode", "Momentum", "Mean Reversion", "Volatility"
  - Cloud-save settings per user (Supabase table)

## WP3 — Volume Profile v2 (Better Math)
- Files:
  - apps/web/lib/ta/volumeProfile.ts
- Tasks:
  - Distribute volume across price range (H-L) rather than close-only
  - Render histogram (right-side VP bars) via SVG/Canvas

## WP4 — Options Chain Real Adapters
- Files:
  - services/market/adapters/tradier.py
  - services/market/adapters/deribit.py
- Tasks:
  - Add strikes/expiry filters and pagination
  - Add Greeks normalization when available
  - Add caching (Redis) to avoid rate limits

## WP5 — Lower Panels (RSI/MACD UI)
- Files:
  - apps/web/components/ProChart.tsx
  - apps/web/lib/ta/series.ts
- Tasks:
  - Render RSI + MACD as separate panels (second chart instance with synced time axis)
