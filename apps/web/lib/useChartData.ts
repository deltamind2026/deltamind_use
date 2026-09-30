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

export function useChartData(symbol: string, tf: string): ChartData {
  const [data, setData] = useState<ChartData>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setData(d => ({ ...d, status: 'loading' }));
    fetch(`${API_URL}/market/ohlc?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(ohlc => {
        if (cancelled) return;
        const candles = ohlc.candles || [];
        const bars: OHLCV[] = candles.map((c: any) => ({
          t: Math.floor(new Date(c.time).getTime() / 1000),
          o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
        }));
        setData({ status: 'ready', bars, candles, marketState: ohlc.market_state || {} });
      })
      .catch(() => { if (!cancelled) setData({ ...EMPTY, status: 'error' }); });
    return () => { cancelled = true; };
  }, [symbol, tf]);

  return data;
}
