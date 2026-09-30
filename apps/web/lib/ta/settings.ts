export type IndicatorKey = 'TREND' | 'RANGE' | 'VOLUME' | 'MOMENTUM' | 'MACD' | 'VWAP';
export type ChartType = 'line' | 'candles';

// Beginner Mode hides every "when you're ready for more" helper: Normal range
// (Bollinger), Momentum (RSI), Average price paid (VWAP) and Momentum shifts (MACD).
export const BEGINNER_MODE_HIDES: IndicatorKey[] = ['RANGE', 'MOMENTUM', 'VWAP', 'MACD'];

export type IndicatorSettings = {
  beginnerMode: boolean;
  chartType: ChartType;
  enabled: Record<IndicatorKey, boolean>;
  params: {
    TREND: { fast: number; slow: number; kind: 'simple' | 'exponential' };
    RANGE: { period: number; stdev: number };
    VOLUME: { avg: number };
    MOMENTUM: { period: number };
    MACD: { fast: number; slow: number; signal: number };
    VWAP: {};
  };
};

// Beginners start with a clean chart: price + one trend view + trading activity.
export const DEFAULT_SETTINGS: IndicatorSettings = {
  beginnerMode: true,
  chartType: 'candles',
  enabled: { TREND: true, RANGE: false, VOLUME: true, MOMENTUM: false, MACD: false, VWAP: false },
  params: {
    TREND: { fast: 20, slow: 50, kind: 'simple' },
    RANGE: { period: 20, stdev: 2 },
    VOLUME: { avg: 20 },
    MOMENTUM: { period: 14 },
    MACD: { fast: 12, slow: 26, signal: 9 },
    VWAP: {},
  },
};

// Flips Beginner Mode and bulk-hides/reveals the advanced helpers.
// Individual switches still work normally afterward.
export function setBeginnerMode(s: IndicatorSettings, on: boolean): IndicatorSettings {
  const enabled = { ...s.enabled };
  for (const key of BEGINNER_MODE_HIDES) enabled[key] = !on;
  return { ...s, beginnerMode: on, enabled };
}

const KEY = 'deltamind_chart_settings_v6';

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Typed-in numbers can be 0, blank or huge; keep every period in a range the math can handle.
export function sanitizeSettings(s: IndicatorSettings): IndicatorSettings {
  const d = DEFAULT_SETTINGS.params;
  const p = s.params;
  const stdev = Number(p.RANGE.stdev);
  return {
    beginnerMode: s.beginnerMode !== false,
    chartType: s.chartType === 'line' ? 'line' : 'candles',
    enabled: { ...DEFAULT_SETTINGS.enabled, ...s.enabled },
    params: {
      TREND: {
        fast: clampInt(p.TREND.fast, 2, 400, d.TREND.fast),
        slow: clampInt(p.TREND.slow, 2, 400, d.TREND.slow),
        kind: p.TREND.kind === 'exponential' ? 'exponential' : 'simple',
      },
      RANGE: {
        period: clampInt(p.RANGE.period, 2, 200, d.RANGE.period),
        stdev: Number.isFinite(stdev) && stdev > 0 ? Math.min(stdev, 5) : d.RANGE.stdev,
      },
      VOLUME: { avg: clampInt(p.VOLUME.avg, 2, 200, d.VOLUME.avg) },
      MOMENTUM: { period: clampInt(p.MOMENTUM.period, 2, 100, d.MOMENTUM.period) },
      MACD: {
        fast: clampInt(p.MACD.fast, 2, 100, d.MACD.fast),
        slow: clampInt(p.MACD.slow, 2, 200, d.MACD.slow),
        signal: clampInt(p.MACD.signal, 2, 100, d.MACD.signal),
      },
      VWAP: {},
    },
  };
}

export function loadSettings(): IndicatorSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const params: any = { ...DEFAULT_SETTINGS.params };
    for (const k of Object.keys(params)) params[k] = { ...params[k], ...(parsed.params?.[k] || {}) };
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed, enabled: { ...DEFAULT_SETTINGS.enabled, ...(parsed.enabled || {}) }, params });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: IndicatorSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
