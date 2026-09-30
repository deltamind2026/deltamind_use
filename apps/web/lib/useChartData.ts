'use client';
import { useEffect, useState } from 'react';
import type { OHLCV } from './ta/series';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';

export type ChartData = {
  status: 'loading' | 'ready' | 'error';
  bars: OHLCV[];
  candles: any[];     // raw API candles, forwarded to the AI endpoints
  marketState: any;
};

const EMPTY: ChartData = { status: 'loading', bars: [], candles: [], marketState: {} };

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
          t: Math.floor(new Date(c.time).getTime() / 1000),
          o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
        }));
        setData({ status: 'ready', bars, candles, marketState: ohlc.market_state || {}, key });
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
