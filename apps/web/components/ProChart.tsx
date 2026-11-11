'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type DeepPartial, type ChartOptions, type MouseEventParams,
} from 'lightweight-charts';
import type { OHLCV } from '../lib/ta/series';
import type { ChartType, IndicatorSettings } from '../lib/ta/settings';
import { COLORS, avgLabel, barContext, fmtPrice, unit, type Computed, type Line } from '../lib/ta/guide';
import { API_URL } from '../lib/useChartData';
import DrawingOverlay, { type Tool } from './DrawingOverlay';
import ExplainerCard, { type Explanation } from './ExplainerCard';

/* ---------------- helpers ---------------- */

const AXIS_WIDTH = 72; // same price-axis width on every pane so they line up

const baseOptions: DeepPartial<ChartOptions> = {
  autoSize: true,
  layout: { background: { color: '#020617' }, textColor: '#94a3b8', fontFamily: 'ui-sans-serif, system-ui' },
  grid: { vertLines: { color: '#0f172a' }, horzLines: { color: '#0f172a' } },
  rightPriceScale: { borderColor: '#1f2a44', minimumWidth: AXIS_WIDTH },
  timeScale: { borderColor: '#1f2a44', rightOffset: 4 },
  crosshair: { mode: CrosshairMode.Magnet },
};

const quiet = { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };

type PriceSeries = Record<'line' | 'candles' | 'volume' | 'rangeUpper' | 'rangeLower' | 'vwap' | 'trendSlow' | 'trendFast', ISeriesApi<any>>;

/** Line data with whitespace for missing values, so every pane has one point per bar (keeps panes aligned). */
function toLine(values: Line, bars: OHLCV[]) {
  return bars.map((b, i) => (values[i] === null ? { time: b.t as UTCTimestamp } : { time: b.t as UTCTimestamp, value: values[i] as number }));
}

// Bar times are Eastern wall-clock times stored as UTC (see useChartData), so they
// are read back as UTC, and intraday ones are labelled ET.
const fmtDate = (t: number, tf: string) =>
  tf === '1D'
    ? new Date(t * 1000).toLocaleString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : `${new Date(t * 1000).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET`;

const fmtVol = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`);

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'line', label: 'Trend line', hint: 'Click and drag across two lows (or two highs) to draw a trend line.' },
  { id: 'level', label: 'Price level', hint: 'Click on the chart to mark a price you care about.' },
  { id: 'fib', label: 'Pullback levels', hint: 'Drag from the bottom of a big move to its top (or top to bottom).' },
  { id: 'period', label: 'Explain a period', hint: 'Drag across a stretch of time and DeltaMind will explain what happened.' },
];

/* ------------------------------------------------ */

export default function ProChart({
  symbol, tf, bars, candles, computed, settings, onChartType,
}: {
  symbol: string;
  tf: string;
  bars: OHLCV[];
  candles: any[];   // the same bars as the API sent them (one per entry in `bars`), for the AI endpoints
  computed: Computed | null;
  settings: IndicatorSettings;
  onChartType: (t: ChartType) => void;
}) {
  const priceRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<PriceSeries | null>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [clearToken, setClearToken] = useState(0);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const explainSeq = useRef(0);

  const barsRef = useRef(bars);
  barsRef.current = bars;
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const { enabled, params } = settings;
  const chartType = settings.chartType;

  /* ---------------- create chart + every series once ---------------- */
  // Series are never removed, only shown/hidden: removing a series while the
  // crosshair is up crashes lightweight-charts v4, and hidden series cost nothing.

  useEffect(() => {
    if (!priceRef.current) return;
    const c = createChart(priceRef.current, baseOptions);
    const volume = c.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume', ...quiet });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const s: PriceSeries = {
      volume,
      line: c.addAreaSeries({
        lineColor: COLORS.price, lineWidth: 2,
        topColor: 'rgba(148,163,184,0.18)', bottomColor: 'rgba(148,163,184,0.0)',
        priceLineColor: '#475569',
      }),
      candles: c.addCandlestickSeries({
        upColor: COLORS.up, downColor: COLORS.down, borderVisible: false,
        wickUpColor: COLORS.up, wickDownColor: COLORS.down,
      }),
      rangeUpper: c.addLineSeries({ color: COLORS.range, lineWidth: 1, lineStyle: LineStyle.Dashed, ...quiet }),
      rangeLower: c.addLineSeries({ color: COLORS.range, lineWidth: 1, lineStyle: LineStyle.Dashed, ...quiet }),
      vwap: c.addLineSeries({ color: COLORS.vwap, lineWidth: 2, lineStyle: LineStyle.Dotted, ...quiet }),
      trendSlow: c.addLineSeries({ color: COLORS.trendSlow, lineWidth: 2, ...quiet }),
      trendFast: c.addLineSeries({ color: COLORS.trendFast, lineWidth: 2, ...quiet }),
    };
    setChart(c);
    setSeries(s);
    return () => { c.remove(); setChart(null); setSeries(null); };
  }, []);

  /* ---------------- data ---------------- */

  useEffect(() => {
    if (!series || !computed) return;
    const T = (b: OHLCV) => b.t as UTCTimestamp;
    series.line.setData(bars.map(b => ({ time: T(b), value: b.c })));
    series.candles.setData(bars.map(b => ({ time: T(b), open: b.o, high: b.h, low: b.l, close: b.c })));
    series.volume.setData(bars.map(b => ({ time: T(b), value: b.v, color: b.c >= b.o ? COLORS.volumeUp : COLORS.volumeDown })));
    series.rangeUpper.setData(toLine(computed.rangeUpper, bars));
    series.rangeLower.setData(toLine(computed.rangeLower, bars));
    series.vwap.setData(toLine(computed.vwap, bars));
    series.trendSlow.setData(toLine(computed.trendSlow, bars));
    series.trendFast.setData(toLine(computed.trendFast, bars));
  }, [series, bars, computed]);

  /* ---------------- visibility ---------------- */

  useEffect(() => {
    if (!series) return;
    const show = (s: ISeriesApi<any>, visible: boolean) => s.applyOptions({ visible });
    show(series.line, chartType === 'line');
    show(series.candles, chartType === 'candles');
    show(series.volume, enabled.VOLUME);
    show(series.rangeUpper, enabled.RANGE);
    show(series.rangeLower, enabled.RANGE);
    show(series.vwap, enabled.VWAP);
    show(series.trendSlow, enabled.TREND);
    show(series.trendFast, enabled.TREND);
    // leave room at the bottom for the volume bars
    series.line.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: enabled.VOLUME ? 0.24 : 0.06 } });
  }, [series, chartType, enabled.VOLUME, enabled.RANGE, enabled.VWAP, enabled.TREND]);

  // Show the whole history whenever a new symbol / timeframe loads.
  useEffect(() => { if (chart && bars.length) chart.timeScale().fitContent(); }, [chart, bars]);

  /* ---------------- hover readout + click to explain ---------------- */

  useEffect(() => {
    if (!chart) return;
    const onMove = (p: MouseEventParams) => {
      if (!p.time || p.logical === undefined) { setHoverIdx(null); return; }
      const i = Math.round(p.logical);
      setHoverIdx(i >= 0 && i < barsRef.current.length ? i : null);
    };
    const onClick = (p: MouseEventParams) => {
      if (toolRef.current !== 'none' || !p.time || p.logical === undefined) return;
      const i = Math.round(p.logical);
      if (i >= 0 && i < barsRef.current.length) explainBarRef.current(i);
    };
    chart.subscribeCrosshairMove(onMove);
    chart.subscribeClick(onClick);
    return () => { chart.unsubscribeCrosshairMove(onMove); chart.unsubscribeClick(onClick); };
  }, [chart]);

  // A new symbol or timeframe makes the old explanation meaningless.
  useEffect(() => { setExplanation(null); setTool('none'); explainSeq.current++; }, [symbol, tf]);

  function explainBar(i: number) {
    const b = bars[i];
    const prev = bars[i - 1];
    const change = prev ? ((b.c - prev.c) / prev.c) * 100 : ((b.c - b.o) / b.o) * 100;
    const avgVol = computed?.volumeAvg[i];
    const u = unit(tf);
    const volLine = avgVol
      ? b.v / avgVol >= 1.5 ? `Trading was **busy**, ${(b.v / avgVol).toFixed(1)}× the usual amount.`
        : b.v / avgVol <= 0.6 ? `Trading was **quiet**, ${(b.v / avgVol).toFixed(1)}× the usual amount.`
        : 'Trading activity was about normal.'
      : '';
    const body = [
      `${symbol} opened at **${fmtPrice(b.o)}** and closed at **${fmtPrice(b.c)}**, ${change >= 0 ? 'up' : 'down'} **${Math.abs(change).toFixed(2)}%** from the ${u.one} before.`,
      `During this ${u.one} the price moved between ${fmtPrice(b.l)} and ${fmtPrice(b.h)}. ${volLine}`,
      // What made this candle notable. Worked out from the chart itself, so there's nothing to wait for.
      barContext(bars, i, tf).join(' '),
    ].filter(Boolean).join('\n\n');

    explainSeq.current++;
    setExplanation({ kind: 'day', title: fmtDate(b.t, tf), body });
  }

  const explainBarRef = useRef(explainBar);
  explainBarRef.current = explainBar;

  function explainPeriod(i0: number, i1: number) {
    const win = bars.slice(i0, i1 + 1);
    const start = win[0], end = win[win.length - 1];
    const change = ((end.c - start.c) / start.c) * 100;
    const hi = win.reduce((m, b) => (b.h > m.h ? b : m));
    const lo = win.reduce((m, b) => (b.l < m.l ? b : m));
    const u = unit(tf);
    const body = [
      `Over these **${win.length} ${u.many}**, ${symbol} went from ${fmtPrice(start.c)} to ${fmtPrice(end.c)}: **${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%**.`,
      `The highest it got was ${fmtPrice(hi.h)} (${fmtDate(hi.t, tf)}) and the lowest was ${fmtPrice(lo.l)} (${fmtDate(lo.t, tf)}).`,
    ].join('\n\n');

    const seq = ++explainSeq.current;
    setExplanation({ kind: 'period', title: `${fmtDate(start.t, tf)} → ${fmtDate(end.t, tf)}`, body, aiLoading: true });
    // Send the whole chart and say which bars were picked, so the explanation can
    // compare this stretch with the rest of the chart and with what came next.
    fetch(`${API_URL}/ai/analyze-period`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe: tf, candles, start: i0, end: i1 }),
    })
      .then(r => r.json())
      .then(d => { if (seq === explainSeq.current) setExplanation(e => e && { ...e, aiLoading: false, aiText: d?.analysis || '' }); })
      .catch(() => { if (seq === explainSeq.current) setExplanation(e => e && { ...e, aiLoading: false, aiText: '' }); });
  }

  /* ---------------- readout values ---------------- */

  const idx = hoverIdx ?? bars.length - 1;
  const bar = bars[idx];
  const prevBar = bars[idx - 1];
  const barChange = bar && prevBar ? ((bar.c - prevBar.c) / prevBar.c) * 100 : null;
  const readout: { color: string; label: string; value: string; dashed?: boolean; bar?: boolean }[] = [];
  if (computed && bar) {
    const v = (l: Line) => (l[idx] === null || l[idx] === undefined ? '—' : fmtPrice(l[idx] as number));
    if (enabled.TREND) {
      readout.push({ color: COLORS.trendFast, label: avgLabel(params.TREND.fast, tf), value: v(computed.trendFast) });
      readout.push({ color: COLORS.trendSlow, label: avgLabel(params.TREND.slow, tf), value: v(computed.trendSlow) });
    }
    if (enabled.RANGE) readout.push({ color: COLORS.range, label: 'Normal range', value: `${v(computed.rangeLower)} – ${v(computed.rangeUpper)}`, dashed: true });
    if (enabled.VWAP) readout.push({ color: COLORS.vwap, label: 'Avg price paid', value: v(computed.vwap) });
    if (enabled.VOLUME) readout.push({ color: COLORS.up, label: 'Shares traded', value: fmtVol(bar.v), bar: true });
  }

  const activeTool = TOOLS.find(t => t.id === tool);

  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={{ background: '#020617', border: '1px solid #1f2a44', borderRadius: 16, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', borderBottom: '1px solid #1f2a44', background: '#0b1226' }}>
          <Segmented
            value={chartType}
            options={[{ value: 'line', label: 'Line' }, { value: 'candles', label: 'Candles' }]}
            onChange={v => onChartType(v as ChartType)}
          />
          <div style={{ width: 1, height: 22, background: '#1f2a44', margin: '0 4px' }} />
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Draw:</span>
          {TOOLS.map(t => (
            <button key={t.id} title={t.hint} onClick={() => setTool(tool === t.id ? 'none' : t.id)} style={chip(tool === t.id)}>{t.label}</button>
          ))}
          <button onClick={() => { setClearToken(n => n + 1); setExplanation(e => (e?.kind === 'day' ? e : null)); }} style={{ ...chip(false), color: '#94a3b8', marginLeft: 'auto' }}>
            Clear drawings
          </button>
        </div>

        {/* Readout: hovered candle, or the latest one */}
        <div style={{ padding: '10px 14px 4px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 18px', minHeight: 44 }}>
          {bar ? (
            <>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{hoverIdx === null ? 'Latest' : fmtDate(bar.t, tf)}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{fmtPrice(bar.c)}</span>
              {barChange !== null && (
                <span style={{ fontSize: 13, fontWeight: 800, color: barChange >= 0 ? COLORS.up : COLORS.down }}>
                  {barChange >= 0 ? '▲' : '▼'} {Math.abs(barChange).toFixed(2)}%
                </span>
              )}
              {chartType === 'candles' && (
                <span style={{ fontSize: 12, color: '#64748b' }}>Open {fmtPrice(bar.o)} · High {fmtPrice(bar.h)} · Low {fmtPrice(bar.l)}</span>
              )}
              {readout.map(r => (
                <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                  <Swatch color={r.color} dashed={r.dashed} bar={r.bar} />
                  {r.label} <b style={{ color: '#e2e8f0' }}>{r.value}</b>
                </span>
              ))}
            </>
          ) : (
            <span style={{ fontSize: 13, color: '#64748b' }}>Loading chart…</span>
          )}
        </div>

        {/* Price chart */}
        <div style={{ position: 'relative', height: 440 }}>
          <div ref={priceRef} style={{ position: 'absolute', inset: 0 }} />
          <DrawingOverlay
            chart={chart}
            series={series ? (chartType === 'candles' ? series.candles : series.line) : null}
            bars={bars}
            storageKey={`dm-drawings-v2:${symbol}:${tf}`}
            tool={tool}
            onToolDone={() => setTool('none')}
            clearToken={clearToken}
            onExplain={e => { explainSeq.current++; setExplanation(e); }}
            onPeriod={explainPeriod}
          />
          {activeTool && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b66', color: '#fcd34d', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {activeTool.hint}
            </div>
          )}
        </div>

        {/* Lower panes (only when switched on) */}
        {chart && computed && enabled.MOMENTUM && (
          <SubPane main={chart} bars={bars} dataKey={computed} title="Momentum" technical={`RSI ${params.MOMENTUM.period}`} hoverIdx={hoverIdx}
            setup={sub => {
              const s = sub.addLineSeries({
                color: COLORS.momentum, lineWidth: 2, ...quiet,
                priceFormat: { type: 'price', precision: 0, minMove: 1 },
                autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
              });
              s.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } });
              s.setData(toLine(computed.momentum, bars));
              s.createPriceLine({ price: 70, color: '#ef444488', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Stretched high' });
              s.createPriceLine({ price: 30, color: '#22c55e88', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Stretched low' });
              return s;
            }}
            value={i => (computed.momentum[i] === null ? '—' : Math.round(computed.momentum[i] as number).toString())}
            legend={[{ color: COLORS.momentum, label: '0–100 score' }]}
          />
        )}
        {chart && computed && enabled.MACD && (
          <SubPane main={chart} bars={bars} dataKey={computed} title="Momentum shifts" technical={`MACD ${params.MACD.fast}/${params.MACD.slow}/${params.MACD.signal}`} hoverIdx={hoverIdx}
            setup={sub => {
              const h = sub.addHistogramSeries({ ...quiet });
              h.setData(bars.map((b, i) => {
                const v = computed.macd.hist[i];
                return v === null ? { time: b.t as UTCTimestamp } : { time: b.t as UTCTimestamp, value: v, color: v >= 0 ? COLORS.volumeUp : COLORS.volumeDown };
              }));
              const l = sub.addLineSeries({ color: COLORS.macd, lineWidth: 2, ...quiet });
              l.setData(toLine(computed.macd.line, bars));
              const sg = sub.addLineSeries({ color: COLORS.macdSignal, lineWidth: 2, ...quiet });
              sg.setData(toLine(computed.macd.signal, bars));
              return l;
            }}
            value={i => {
              const v = computed.macd.hist[i];
              return v === null ? '—' : v >= 0 ? 'building up' : 'building down';
            }}
            legend={[{ color: COLORS.macd, label: 'fast' }, { color: COLORS.macdSignal, label: 'slow' }, { color: COLORS.volumeUp, label: 'difference' }]}
          />
        )}

        <div style={{ padding: '8px 14px', borderTop: '1px solid #1f2a44', fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Tip: click any point on the chart to see what happened then.</span>
          {chartType === 'candles' && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 8, height: 12, background: COLORS.up, borderRadius: 2 }} /> closed higher than it opened
              <span style={{ width: 8, height: 12, background: COLORS.down, borderRadius: 2, marginLeft: 8 }} /> closed lower
            </span>
          )}
        </div>
      </div>

      {explanation && <ExplainerCard e={explanation} onClose={() => { explainSeq.current++; setExplanation(null); }} />}
    </div>
  );
}

/* ---------------- lower pane, synced to the main chart ---------------- */

function SubPane({
  main, bars, dataKey, title, technical, setup, value, legend, hoverIdx,
}: {
  main: IChartApi;
  bars: OHLCV[];
  dataKey: unknown; // pane is rebuilt when this changes (the computed indicators)
  title: string;
  technical: string;
  setup: (sub: IChartApi) => ISeriesApi<any>;
  value: (i: number) => string;
  legend: { color: string; label: string }[];
  hoverIdx: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    if (!ref.current) return;
    const sub = createChart(ref.current, {
      ...baseOptions,
      timeScale: { ...baseOptions.timeScale, visible: false },
      // only the vertical line is mirrored from the main chart
      crosshair: { mode: CrosshairMode.Normal, horzLine: { visible: false, labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const series = setupRef.current(sub);

    const ts = main.timeScale();
    const sync = (range: any) => { if (range) sub.timeScale().setVisibleLogicalRange(range); };
    // A range set before autoSize has measured the pane gets lost, so re-sync after every resize.
    let raf = 0;
    const resync = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => sync(ts.getVisibleLogicalRange())); };
    const ro = new ResizeObserver(resync);
    ro.observe(ref.current);
    resync();
    ts.subscribeVisibleLogicalRangeChange(sync);

    const cross = (p: MouseEventParams) => {
      if (p.time) sub.setCrosshairPosition(0, p.time, series);
      else sub.clearCrosshairPosition();
    };
    main.subscribeCrosshairMove(cross);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(sync);
      main.unsubscribeCrosshairMove(cross);
      sub.remove();
    };
  }, [main, bars, dataKey]);

  const i = hoverIdx ?? bars.length - 1;

  return (
    <div style={{ borderTop: '1px solid #1f2a44' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 0', fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
        <b style={{ color: '#e2e8f0', fontSize: 13 }}>{title}</b>
        <span style={{ color: '#64748b' }}>{technical}</span>
        <b style={{ color: '#e2e8f0' }}>{value(i)}</b>
        {legend.map(l => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Swatch color={l.color} /> {l.label}
          </span>
        ))}
      </div>
      <div ref={ref} style={{ height: 130 }} />
    </div>
  );
}

/* ---------------- small UI bits ---------------- */

export function Swatch({ color, dashed = false, bar = false }: { color: string; dashed?: boolean; bar?: boolean }) {
  // bar: a small vertical block, matching histogram series like volume
  if (bar) return <span style={{ width: 4, height: 12, borderRadius: 1, flexShrink: 0, display: 'inline-block', background: color }} />;
  return (
    <span style={{
      width: 16, height: 3, borderRadius: 2, flexShrink: 0, display: 'inline-block',
      background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color,
    }} />
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#020617', border: '1px solid #1f2a44', borderRadius: 10, padding: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
          background: value === o.value ? '#1e3a8a' : 'transparent', color: value === o.value ? '#e0e7ff' : '#94a3b8',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
    border: `1px solid ${active ? '#f59e0b' : '#1f2a44'}`,
    color: active ? '#fcd34d' : '#cbd5e1',
  };
}
