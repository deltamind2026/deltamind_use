
export type IndicatorKey = 'SMA'|'EMA'|'VWAP'|'RSI'|'MACD'|'BOLL'|'VOLUME_PROFILE';

// Advanced indicators Beginner Mode hides by default. SMA, VWAP, EMA and
// Volume Profile stay visible either way -- only these three are toggled.
export const BEGINNER_MODE_HIDES: IndicatorKey[] = ['BOLL', 'RSI', 'MACD'];

export type IndicatorSettings = {
  beginnerMode: boolean;
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
  // New accounts start in Beginner Mode, so the advanced indicators below
  // start hidden. An existing user's saved settings (loadSettings) always
  // win over these defaults, so this does not change what current users see.
  beginnerMode: true,
  enabled: { SMA:true, EMA:true, VWAP:true, RSI:false, MACD:false, BOLL:false, VOLUME_PROFILE:true },
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

// Flips Beginner Mode and bulk-hides/reveals the advanced indicators.
// Individual checkboxes still work normally afterward -- this is just the
// one-click bulk action described in the Beginner Mode story.
export function setBeginnerMode(s: IndicatorSettings, on: boolean): IndicatorSettings {
  const enabled = { ...s.enabled };
  for (const key of BEGINNER_MODE_HIDES) enabled[key] = !on;
  return { ...s, beginnerMode: on, enabled };
}

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
