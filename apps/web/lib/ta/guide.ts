import type { OHLCV } from './series';
import { bollinger, ema, macd, rsi, sma, vwap } from './series';
import type { IndicatorKey, IndicatorSettings } from './settings';

/* ---------------- shared palette ---------------- */

export const COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  price: '#e2e8f0',
  trendFast: '#fbbf24',
  trendSlow: '#c084fc',
  range: '#64748b',
  vwap: '#2dd4bf',
  momentum: '#60a5fa',
  macd: '#60a5fa',
  macdSignal: '#fb923c',
  volumeUp: 'rgba(34,197,94,0.35)',
  volumeDown: 'rgba(239,68,68,0.35)',
};

/* ---------------- timeframe wording ---------------- */

const UNIT: Record<string, { one: string; many: string; latest: string }> = {
  '1D': { one: 'day', many: 'days', latest: 'today' },
  '4H': { one: '4-hour period', many: '4-hour periods', latest: 'the latest 4 hours' },
  '1H': { one: 'hour', many: 'hours', latest: 'the latest hour' },
  '15m': { one: '15-minute period', many: '15-minute periods', latest: 'the latest 15 minutes' },
};
export const unit = (tf: string) => UNIT[tf] || UNIT['1D'];

/** "20-day average" on the daily chart, "20-hour average" on the hourly chart, etc. */
export function avgLabel(period: number, tf: string) {
  const u = unit(tf).one;
  const short = u === 'day' ? 'day' : u === 'hour' ? 'hour' : 'period';
  return `${period}-${short} average`;
}

/* ---------------- computed series ---------------- */

export type Line = (number | null)[];
export type Computed = {
  trendFast: Line;
  trendSlow: Line;
  rangeUpper: Line;
  rangeMid: Line;
  rangeLower: Line;
  volumeAvg: Line;
  momentum: Line;
  macd: { line: Line; signal: Line; hist: Line };
  vwap: Line;
};

export function computeIndicators(bars: OHLCV[], s: IndicatorSettings): Computed {
  const closes = bars.map(b => b.c);
  const p = s.params;
  const avg = p.TREND.kind === 'exponential' ? ema : sma;
  const bb = bollinger(closes, p.RANGE.period, p.RANGE.stdev);
  return {
    trendFast: avg(closes, p.TREND.fast),
    trendSlow: avg(closes, p.TREND.slow),
    rangeUpper: bb.upper,
    rangeMid: bb.mid,
    rangeLower: bb.lower,
    volumeAvg: sma(bars.map(b => b.v), p.VOLUME.avg),
    momentum: rsi(closes, p.MOMENTUM.period),
    macd: macd(closes, p.MACD.fast, p.MACD.slow, p.MACD.signal),
    vwap: vwap(bars),
  };
}

/* ---------------- catalog ---------------- */

export type Tone = 'up' | 'down' | 'neutral';
export type Reading = { tone: Tone; headline: string; detail?: string };

export type GuideEntry = {
  key: IndicatorKey;
  name: string;
  technical: string;
  what: string;
  howToRead: string[];
  pane: 'price' | 'below';
  level: 'basic' | 'more';
};

export const GUIDE: GuideEntry[] = [
  {
    key: 'TREND',
    name: 'Trend lines',
    technical: 'Moving averages',
    what: 'Smooth out the daily ups and downs so you can see which way the price is really heading.',
    howToRead: [
      'Price above the lines usually means the stock has been rising.',
      'When the short line crosses above the long line, the trend may be turning up (and the opposite for down).',
    ],
    pane: 'price',
    level: 'basic',
  },
  {
    key: 'VOLUME',
    name: 'Trading activity',
    technical: 'Volume',
    what: 'How many shares changed hands. Bars at the bottom of the chart: taller means busier.',
    howToRead: [
      'Big price moves on heavy activity are more meaningful than moves on quiet days.',
      'Green bars are periods the price rose, red bars are periods it fell.',
    ],
    pane: 'price',
    level: 'basic',
  },
  {
    key: 'RANGE',
    name: 'Normal range',
    technical: 'Bollinger Bands',
    what: 'A band around the price showing where it usually stays. Moves outside the band are unusual.',
    howToRead: [
      'Touching the top or bottom edge means the price is stretched compared to its recent normal.',
      'A band that gets narrow means things are calm; big moves often follow calm periods.',
    ],
    pane: 'price',
    level: 'more',
  },
  {
    key: 'MOMENTUM',
    name: 'Momentum',
    technical: 'RSI',
    what: 'A 0–100 score of how strongly the price has been moving up vs. down lately.',
    howToRead: [
      'Above 70: the price rose fast and may be stretched. Below 30: it fell fast.',
      'Stretched does not mean it must reverse. Strong stocks can stay above 70 for a while.',
    ],
    pane: 'below',
    level: 'more',
  },
  {
    key: 'VWAP',
    name: 'Average price paid',
    technical: 'VWAP',
    what: 'The average price people paid for the stock across this chart, weighted by how many shares traded.',
    howToRead: [
      'Price above this line means the typical buyer on this chart is sitting on a gain.',
      'Big investors often compare their buying price to this line.',
    ],
    pane: 'price',
    level: 'more',
  },
  {
    key: 'MACD',
    name: 'Momentum shifts',
    technical: 'MACD',
    what: 'Tracks when momentum is speeding up or slowing down by comparing a fast and a slow average.',
    howToRead: [
      'Bars above zero: upward momentum is building. Below zero: downward momentum.',
      'When the blue line crosses above the orange one, momentum is turning up.',
    ],
    pane: 'below',
    level: 'more',
  },
];

/** Colour swatches shown next to each indicator, matching what's drawn on the chart. */
export function swatches(key: IndicatorKey): { color: string; dashed?: boolean; bar?: boolean; label?: string }[] {
  switch (key) {
    case 'TREND': return [{ color: COLORS.trendFast, label: 'short' }, { color: COLORS.trendSlow, label: 'long' }];
    case 'RANGE': return [{ color: COLORS.range, dashed: true }];
    case 'VOLUME': return [{ color: COLORS.up, bar: true }, { color: COLORS.down, bar: true }];
    case 'MOMENTUM': return [{ color: COLORS.momentum }];
    case 'VWAP': return [{ color: COLORS.vwap }];
    case 'MACD': return [{ color: COLORS.macd }, { color: COLORS.macdSignal }];
  }
}

/* ---------------- plain-language readings ---------------- */

const lastVal = (l: Line) => {
  for (let i = l.length - 1; i >= 0; i--) if (l[i] !== null) return l[i] as number;
  return null;
};
const pct = (a: number, b: number) => ((a - b) / b) * 100;
const fmtPct = (n: number) => `${Math.abs(n).toFixed(1)}%`;
export const fmtPrice = (n: number) => `$${n.toFixed(2)}`;

export function readIndicator(key: IndicatorKey, bars: OHLCV[], c: Computed, s: IndicatorSettings, tf: string): Reading | null {
  if (bars.length < 2) return null;
  const close = bars[bars.length - 1].c;
  const u = unit(tf);
  const p = s.params;

  switch (key) {
    case 'TREND': {
      const f = lastVal(c.trendFast);
      const sl = lastVal(c.trendSlow);
      if (f === null || sl === null) return { tone: 'neutral', headline: 'Not enough history yet to draw both lines.' };
      const vsSlow = pct(close, sl);
      const longName = avgLabel(p.TREND.slow, tf);
      if (close > f && f > sl) return { tone: 'up', headline: 'Uptrend', detail: `Price is above both lines and the short line is above the long one. Price is ${fmtPct(vsSlow)} above its ${longName}.` };
      if (close < f && f < sl) return { tone: 'down', headline: 'Downtrend', detail: `Price is below both lines and the short line is below the long one. Price is ${fmtPct(vsSlow)} below its ${longName}.` };
      return { tone: 'neutral', headline: 'No clear trend', detail: `The price and the two lines are tangled together, which usually means the stock is moving sideways. Price is ${fmtPct(vsSlow)} ${vsSlow >= 0 ? 'above' : 'below'} its ${longName}.` };
    }
    case 'VOLUME': {
      const avg = lastVal(c.volumeAvg);
      const v = bars[bars.length - 1].v;
      if (!avg) return null;
      const r = v / avg;
      if (r >= 1.5) return { tone: 'neutral', headline: `Busy: ${r.toFixed(1)}× normal`, detail: `Trading ${u.latest} is well above the usual level. Something may have caught investors' attention.` };
      if (r <= 0.6) return { tone: 'neutral', headline: `Quiet: ${r.toFixed(1)}× normal`, detail: `Fewer shares than usual traded ${u.latest}. Price moves on quiet periods carry less weight.` };
      return { tone: 'neutral', headline: 'Normal activity', detail: `Trading ${u.latest} is close to its ${p.VOLUME.avg}-${u.one === 'day' ? 'day' : 'period'} average.` };
    }
    case 'RANGE': {
      const up = lastVal(c.rangeUpper);
      const lo = lastVal(c.rangeLower);
      if (up === null || lo === null) return null;
      const pos = (close - lo) / Math.max(1e-9, up - lo);
      if (pos > 1) return { tone: 'up', headline: 'Above the normal range', detail: 'An unusually strong move up. Prices often drift back inside the band afterward, but not always.' };
      if (pos < 0) return { tone: 'down', headline: 'Below the normal range', detail: 'An unusually sharp drop. Prices often drift back inside the band afterward, but not always.' };
      if (pos > 0.8) return { tone: 'up', headline: 'Near the top of its range', detail: `Price is close to the upper edge (${fmtPrice(up)}).` };
      if (pos < 0.2) return { tone: 'down', headline: 'Near the bottom of its range', detail: `Price is close to the lower edge (${fmtPrice(lo)}).` };
      return { tone: 'neutral', headline: 'Inside its normal range', detail: `Usual range right now: ${fmtPrice(lo)} to ${fmtPrice(up)}.` };
    }
    case 'MOMENTUM': {
      const r = lastVal(c.momentum);
      if (r === null) return null;
      const v = Math.round(r);
      if (r >= 70) return { tone: 'up', headline: `${v}: stretched high`, detail: 'The price has risen quickly. Fast run-ups often slow down or pause.' };
      if (r <= 30) return { tone: 'down', headline: `${v}: stretched low`, detail: 'The price has fallen quickly. Sharp drops often slow down or bounce.' };
      if (r >= 55) return { tone: 'up', headline: `${v}: leaning up`, detail: 'Buyers have had a bit more control lately.' };
      if (r <= 45) return { tone: 'down', headline: `${v}: leaning down`, detail: 'Sellers have had a bit more control lately.' };
      return { tone: 'neutral', headline: `${v}: balanced`, detail: 'Neither buyers nor sellers have a clear edge.' };
    }
    case 'VWAP': {
      const vw = lastVal(c.vwap);
      if (vw === null) return null;
      const d = pct(close, vw);
      return d >= 0
        ? { tone: 'up', headline: `${fmtPct(d)} above`, detail: `The average price paid on this chart is ${fmtPrice(vw)}. The typical buyer here is ahead.` }
        : { tone: 'down', headline: `${fmtPct(d)} below`, detail: `The average price paid on this chart is ${fmtPrice(vw)}. The typical buyer here is behind.` };
    }
    case 'MACD': {
      const h = c.macd.hist;
      const now = lastVal(h);
      if (now === null) return null;
      let crossedAgo = -1;
      for (let i = h.length - 1, n = 0; i > 0 && n < 10; i--, n++) {
        if (h[i] !== null && h[i - 1] !== null && Math.sign(h[i] as number) !== Math.sign(h[i - 1] as number)) { crossedAgo = n; break; }
      }
      const dir = now >= 0 ? 'up' : 'down';
      const when = crossedAgo === 0 ? u.latest : `${crossedAgo} ${crossedAgo === 1 ? u.one : u.many} ago`;
      if (crossedAgo >= 0) return { tone: dir, headline: `Just turned ${dir}`, detail: `Momentum flipped ${dir}ward ${when}.` };
      return { tone: dir, headline: `${dir === 'up' ? 'Upward' : 'Downward'} momentum`, detail: `Momentum has been pointing ${dir} for a while.` };
    }
  }
}

/** One-sentence summary of where the stock is on this chart. */
export function summarize(bars: OHLCV[], tf: string) {
  if (bars.length < 2) return null;
  const first = bars[0].c;
  const last = bars[bars.length - 1].c;
  const prev = bars[bars.length - 2].c;
  return {
    price: last,
    change: pct(last, prev),
    periodChange: pct(last, first),
    periodLabel: `over the last ${bars.length} ${unit(tf).many}`,
    high: Math.max(...bars.map(b => b.h)),
    low: Math.min(...bars.map(b => b.l)),
  };
}
