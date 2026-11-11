'use client';
import { useEffect, useState } from 'react';
import type { OHLCV } from './ta/series';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';

export type ChartData = {
  status: 'loading' | 'ready' | 'error';
  bars: OHLCV[];
  candles: any[];     // raw API candles, forwarded to the AI endpoints
  snapshot: any;      // plain-language facts from the market service, see AiInsight
};

// The market's clock. Bar times arrive in UTC; the chart, the cards and the AI
// text all show them in US Eastern so they agree with each other wherever the
// reader is. The chart library draws whatever "UTC" time it is given, so each
// bar is stored as its Eastern wall-clock time written as if it were UTC.
const EASTERN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

export function easternTime(utc: string): number {
  // API times have no zone marker; without one the browser would read them as local time.
  const at = new Date(/Z$|[+-]\d\d:\d\d$/.test(utc) ? utc : `${utc}Z`);
  const p: Record<string, number> = {};
  for (const part of EASTERN.formatToParts(at)) p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;
}

const EMPTY: ChartData = { status: 'loading', bars: [], candles: [], snapshot: null };

type Loaded = ChartData & { key: string };

export function useChartData(symbol: string, tf: string): ChartData {
  const [data, setData] = useState<Loaded>({ ...EMPTY, key: '' });
  const key = `${symbol}|${tf}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/market/ohlc?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(ohlc => {
        if (cancelled) return;
        const candles = ohlc.candles || [];
        const bars: OHLCV[] = candles.map((c: any) => ({
          t: easternTime(c.time),
          o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
        }));
        setData({ status: 'ready', bars, candles, snapshot: ohlc.snapshot || null, key });
      })
      .catch(() => { if (!cancelled) setData({ ...EMPTY, status: 'error', key }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Data belongs to the symbol/timeframe it was fetched for. Right after a switch
  // the old bars are still here, so report 'loading' until the new ones arrive;
  // otherwise consumers see the new tf paired with the old candles.
  // (Old bars are still returned so the chart doesn't flash empty.)
  const { key: loadedKey, ...rest } = data;
  return loadedKey === key ? rest : { ...rest, status: 'loading' };
}
