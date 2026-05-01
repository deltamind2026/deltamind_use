
export type IndicatorKey = 'SMA'|'EMA'|'VWAP'|'RSI'|'MACD'|'BOLL'|'VOLUME_PROFILE';

export type IndicatorSettings = {
  enabled: Record<IndicatorKey, boolean>;
  params: {
    SMA: { period:number };
    EMA: { period:number };
    VWAP: {};
    RSI: { period:number };
    MACD: { fast:number; slow:number; signal:number };
    BOLL: { period:number; stdev:number };
    VOLUME_PROFILE: { binSize:number };
  };
};

export const DEFAULT_SETTINGS: IndicatorSettings = {
  enabled: { SMA:true, EMA:true, VWAP:true, RSI:true, MACD:true, BOLL:true, VOLUME_PROFILE:true },
  params: {
    SMA:{ period:20 },
    EMA:{ period:50 },
    VWAP:{},
    RSI:{ period:14 },
    MACD:{ fast:12, slow:26, signal:9 },
    BOLL:{ period:20, stdev:2 },
    VOLUME_PROFILE:{ binSize:2 }
  }
};

const KEY = 'deltamind_indicator_settings_v52';

export function loadSettings(): IndicatorSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, enabled:{...DEFAULT_SETTINGS.enabled, ...(parsed.enabled||{})}, params:{...DEFAULT_SETTINGS.params, ...(parsed.params||{})} };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: IndicatorSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}
