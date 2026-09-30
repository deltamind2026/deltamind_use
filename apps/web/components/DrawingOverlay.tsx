'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Logical } from 'lightweight-charts';
import type { OHLCV } from '../lib/ta/series';
import { fmtPrice } from '../lib/ta/guide';
import type { Explanation } from './ExplainerCard';

export type Tool = 'none' | 'line' | 'level' | 'fib' | 'period';

type Anchor = { t: number; p: number };
type Drawing =
  | { kind: 'line'; a: Anchor; b: Anchor }
  | { kind: 'level'; a: Anchor }
  | { kind: 'fib'; a: Anchor; b: Anchor }
  | { kind: 'period'; a: Anchor; b: Anchor };

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const INK = { line: '#38bdf8', level: '#f472b6', fib: '#a78bfa', period: '#22d3ee', preview: '#f59e0b' };

export default function DrawingOverlay({
  chart, series, bars, storageKey, tool, onToolDone, clearToken, onExplain, onPeriod,
}: {
  chart: IChartApi | null;
  series: ISeriesApi<any> | null;
  bars: OHLCV[];
  storageKey: string;
  tool: Tool;
  onToolDone: () => void;
  clearToken: number;
  onExplain: (e: Explanation) => void;
  onPeriod: (startIdx: number, endIdx: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const loadedKey = useRef<string | null>(null);
  const drag = useRef<{ a: Anchor; b: Anchor } | null>(null);

  const indexOf = useCallback((t: number) => {
    // bars are sorted by time; binary search for the bar at (or just before) t
    let lo = 0, hi = bars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bars[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }, [bars]);

  /* ---------- persistence (per symbol + timeframe) ---------- */

  useEffect(() => {
    loadedKey.current = null;
    let next: Drawing[] = [];
    try { next = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
    setDrawings(Array.isArray(next) ? next : []);
    loadedKey.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey.current !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(drawings)); } catch {}
  }, [drawings, storageKey]);

  useEffect(() => { if (clearToken) setDrawings([]); }, [clearToken]);

  /* ---------- coordinate conversion ---------- */

  const toAnchor = useCallback((x: number, y: number): Anchor | null => {
    if (!chart || !series || !bars.length) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    const i = Math.min(bars.length - 1, Math.max(0, Math.round(logical)));
    return { t: bars[i].t, p: price as number };
  }, [chart, series, bars]);

  const xOf = useCallback((t: number) => {
    if (!chart) return null;
    return chart.timeScale().logicalToCoordinate(indexOf(t) as Logical);
  }, [chart, indexOf]);

  const yOf = useCallback((p: number) => series?.priceToCoordinate(p) ?? null, [series]);

  /* ---------- rendering ---------- */

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !chart || !series || !bars.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pane = chart.paneSize();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, pane.width, pane.height);
    ctx.clip();
    ctx.font = '600 11px ui-sans-serif, system-ui';

    const all: (Drawing & { preview?: boolean })[] = [...drawings];
    if (drag.current && tool !== 'none' && tool !== 'level') all.push({ kind: tool, ...drag.current, preview: true } as any);

    for (const d of all) {
      const ink = d.preview ? INK.preview : INK[d.kind];
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.setLineDash(d.preview ? [6, 5] : []);

      if (d.kind === 'level') {
        const y = yOf(d.a.p);
        if (y === null) continue;
        ctx.lineWidth = 1.5;
        line(ctx, 0, y, pane.width, y);
        label(ctx, `Your level ${fmtPrice(d.a.p)}`, 8, y - 6, ink);
        continue;
      }

      const xa = xOf(d.a.t), xb = xOf(d.b.t), ya = yOf(d.a.p), yb = yOf(d.b.p);
      if (xa === null || xb === null || ya === null || yb === null) continue;

      if (d.kind === 'line') {
        ctx.lineWidth = 2;
        line(ctx, xa, ya, xb, yb);
        if (!d.preview && xb !== xa) {
          // faint extension shows where the line is heading
          const [x0, y0, x1, y1] = xa < xb ? [xa, ya, xb, yb] : [xb, yb, xa, ya];
          const slope = (y1 - y0) / (x1 - x0);
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.5;
          line(ctx, x1, y1, pane.width, y1 + slope * (pane.width - x1));
          ctx.globalAlpha = 1;
        }
      } else if (d.kind === 'fib') {
        const hi = Math.max(d.a.p, d.b.p), lo = Math.min(d.a.p, d.b.p);
        const left = Math.min(xa, xb);
        ctx.globalAlpha = 0.08;
        ctx.fillRect(left, Math.min(ya, yb), pane.width - left, Math.abs(yb - ya));
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        for (const lv of FIB_LEVELS) {
          const price = hi - (hi - lo) * lv;
          const y = yOf(price);
          if (y === null) continue;
          line(ctx, left, y, pane.width, y);
          label(ctx, `${(lv * 100).toFixed(1)}%  ${fmtPrice(price)}`, left + 4, y - 4, ink);
        }
      } else if (d.kind === 'period') {
        const left = Math.min(xa, xb), w = Math.abs(xb - xa);
        ctx.globalAlpha = 0.12;
        ctx.fillRect(left, 0, w, pane.height);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.strokeRect(left, 0, w, pane.height);
        label(ctx, 'Explained period', left + 6, 16, ink);
      }
    }
    ctx.restore();
  }, [chart, series, bars, drawings, tool, xOf, yOf]);

  // Keep drawings pinned to the data while the chart scrolls, zooms or resizes.
  useEffect(() => {
    if (!chart) return;
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(redraw); };
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(schedule);
    ts.subscribeSizeChange(schedule);
    chart.subscribeCrosshairMove(schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ts.unsubscribeVisibleLogicalRangeChange(schedule);
      ts.unsubscribeSizeChange(schedule);
      chart.unsubscribeCrosshairMove(schedule);
    };
  }, [chart, redraw]);

  /* ---------- pointer handling ---------- */

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return toAnchor(e.clientX - r.left, e.clientY - r.top);
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const a = point(e);
    if (!a) return;
    if (tool === 'level') {
      const d: Drawing = { kind: 'level', a };
      setDrawings(prev => [...prev, d]);
      onExplain(explainLevel(d.a.p, bars));
      onToolDone();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { a, b: a };
    redraw();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const b = point(e);
    if (b) { drag.current.b = b; redraw(); }
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || tool === 'none' || tool === 'level') return;
    const ia = indexOf(d.a.t), ib = indexOf(d.b.t);

    if (tool === 'period') {
      if (Math.abs(ib - ia) < 2) {
        onExplain({ kind: 'period', title: 'Pick a wider period', body: 'Drag across at least a few candles to explain what happened.' });
      } else {
        const [a, b] = ia < ib ? [d.a, d.b] : [d.b, d.a];
        setDrawings(prev => [...prev.filter(x => x.kind !== 'period'), { kind: 'period', a, b }]);
        onPeriod(Math.min(ia, ib), Math.max(ia, ib));
      }
    } else if (ia !== ib || d.a.p !== d.b.p) {
      const next: Drawing = { kind: tool, a: d.a, b: d.b };
      setDrawings(prev => [...prev, next]);
      onExplain(tool === 'line' ? explainLine(d.a, d.b, ia, ib, bars) : explainFib(d.a.p, d.b.p, bars));
    }
    onToolDone();
    redraw();
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5,
        cursor: tool === 'none' ? 'default' : 'crosshair',
        pointerEvents: tool === 'none' ? 'none' : 'auto',
        touchAction: tool === 'none' ? 'auto' : 'none',
      }}
    />
  );
}

/* ---------------- canvas helpers ---------------- */

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  const w = ctx.measureText(text).width;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(2,6,23,0.85)';
  ctx.fillRect(x - 3, y - 11, w + 6, 15);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ---------------- plain-language explanations ---------------- */

function explainLine(a: Anchor, b: Anchor, ia: number, ib: number, bars: OHLCV[]): Explanation {
  const [p0, i0, p1, i1] = ia <= ib ? [a.p, ia, b.p, ib] : [b.p, ib, a.p, ia];
  const last = bars.length - 1;
  const close = bars[last].c;
  const slope = i1 === i0 ? 0 : (p1 - p0) / (i1 - i0);
  const lineNow = p1 + slope * (last - i1);
  const gap = ((close - lineNow) / lineNow) * 100;
  const rising = slope > 0;

  const body = [
    `**What you drew:** a ${rising ? 'rising' : slope < 0 ? 'falling' : 'flat'} line from ${fmtPrice(p0)} to ${fmtPrice(p1)}.`,
    rising
      ? 'Rising lines drawn under the lows act like a **floor**: buyers have been stepping in at higher and higher prices.'
      : 'Falling lines drawn over the highs act like a **ceiling**: sellers have been stepping in at lower and lower prices.',
    `**Right now:** if you extend the line to today it sits near ${fmtPrice(lineNow)}, and the price is ${fmtPrice(close)} (${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? 'above' : 'below'} it).`,
    Math.abs(gap) < 1
      ? 'The price is right at your line. Watch whether it bounces off it or breaks through.'
      : rising
        ? (gap > 0 ? 'The floor is holding so far.' : 'The price has dropped through the floor, which can mean the upward trend is weakening.')
        : (gap < 0 ? 'The ceiling is holding so far.' : 'The price has pushed through the ceiling, which can mean the downward trend is losing steam.'),
  ].join('\n\n');
  return { kind: 'drawing', title: 'Your trend line', body };
}

function explainLevel(level: number, bars: OHLCV[]): Explanation {
  const close = bars[bars.length - 1].c;
  const touches = bars.filter(b => b.l <= level && b.h >= level).length;
  const gap = ((close - level) / level) * 100;
  const role = close >= level ? 'support (a floor below the price)' : 'resistance (a ceiling above the price)';
  const body = [
    `**What you marked:** ${fmtPrice(level)}. The price is currently ${fmtPrice(close)}, ${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? 'above' : 'below'} it.`,
    `**History:** the price traded through this level on **${touches}** of the ${bars.length} candles on this chart.`,
    touches >= 5
      ? `Prices that keep coming back to the same level are worth watching. This one could act as ${role}.`
      : 'The price has not spent much time here, so this level may not matter much yet.',
  ].join('\n\n');
  return { kind: 'drawing', title: 'Your price level', body };
}

function explainFib(pa: number, pb: number, bars: OHLCV[]): Explanation {
  const hi = Math.max(pa, pb), lo = Math.min(pa, pb), range = hi - lo;
  const close = bars[bars.length - 1].c;
  const levels = [
    { name: '23.6%, a shallow pullback', price: hi - range * 0.236 },
    { name: '38.2%, a common bounce area', price: hi - range * 0.382 },
    { name: '50%, halfway back', price: hi - range * 0.5 },
    { name: '61.8%, the "golden ratio" level', price: hi - range * 0.618 },
    { name: '78.6%, a deep pullback', price: hi - range * 0.786 },
  ];
  const nearest = levels.reduce((m, l) => (Math.abs(l.price - close) < Math.abs(m.price - close) ? l : m));
  const body = [
    `**What you drew:** a move between ${fmtPrice(lo)} and ${fmtPrice(hi)}.`,
    'After a big move, prices often "take a breath" and give back part of it. These lines mark the spots where traders commonly expect that pullback to pause.',
    levels.map(l => `• ${fmtPrice(l.price)}: ${l.name}`).join('\n'),
    `**Right now:** the price (${fmtPrice(close)}) is closest to the ${nearest.name.split(',')[0]} level at ${fmtPrice(nearest.price)}.`,
  ].join('\n\n');
  return { kind: 'drawing', title: 'Pullback levels', body };
}
