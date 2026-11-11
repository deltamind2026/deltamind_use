'use client';
import React, { useEffect, useState } from 'react';
import InfoTooltip from './InfoTooltip';
import { COLORS, fmtPrice } from '../lib/ta/guide';
import { API_URL } from '../lib/useChartData';

/** Shape of `snapshot` from /market/ohlc (services/market/metrics/snapshot.py). */
type Level = { price: number; distance_pct: number; touches: number } | null;
export type Snapshot = {
  price: number;
  unit: { one: string; many: string };
  bars: number;
  trend: {
    direction: 'up' | 'down' | 'sideways'; change_pct: number; bars: number; recent_change_pct: number; recent_bars: number;
    /** The S&P 500 over the same `bars`, for comparison. Missing when there's nothing to compare with. */
    market_change_pct?: number | null;
  };
  swings: { label: 'calmer' | 'normal' | 'wilder'; typical_move_pct: number; usual_move_pct: number };
  range: { low: number; high: number; position: number; where: keyof typeof WHERE; from_high_pct: number };
  levels: { floor: Level; ceiling: Level };
  /** True when live prices weren't available and the chart is showing made-up data. */
  sample_data?: boolean;
  // The snapshot also carries `story` (the big moves, with dates). Only the AI reads that part.
};

type AiSummary = { headline: string; story: string; watch: string[] };

const MUTED = '#94a3b8';
const AMBER = '#fbbf24';

const DIRECTION = {
  up: { label: 'Rising', icon: '▲', color: COLORS.up },
  down: { label: 'Falling', icon: '▼', color: COLORS.down },
  sideways: { label: 'Sideways', icon: '▬', color: '#cbd5e1' },
};
const SWINGS = {
  calmer: { label: 'Calmer than usual', color: '#cbd5e1' },
  normal: { label: 'About normal', color: '#cbd5e1' },
  wilder: { label: 'Bigger than usual', color: AMBER },
};
const WHERE = {
  top: 'Near the top',
  upper: 'In the upper part',
  middle: 'In the middle',
  lower: 'In the lower part',
  bottom: 'Near the bottom',
};

const pct = (n: number) => `${n >= 0 ? 'up' : 'down'} ${Math.abs(n).toFixed(1)}%`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "159 days" reads as noise; "about 8 months" doesn't (~21 trading days a month). */
function span(bars: number, unit: Snapshot['unit']) {
  if (unit.one === 'day' && bars >= 40) return `about ${Math.round(bars / 21)} months`;
  if (unit.one === 'week' && bars >= 8) return `about ${Math.round(bars / 4.3)} months`;
  return `${bars} ${unit.many}`;
}

export default function AiInsight({ symbol, tf, snapshot }: { symbol: string; tf: string; snapshot: Snapshot | null }) {
  const [ai, setAi] = useState<{ loading: boolean; data: AiSummary | null }>({ loading: true, data: null });
  const [waking, setWaking] = useState(false);
  const usable = !!snapshot?.trend;

  useEffect(() => {
    if (!usable) return;
    // Aborting on cleanup means a superseded run (a quick symbol/timeframe switch,
    // or React Strict Mode's mount-unmount-mount in dev) never reaches /ai/explain.
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setAi({ loading: true, data: null });
    setWaking(false);
    (async () => {
      // The AI service can be asleep on first use, and the market service answers
      // 503 while it starts. Only that is worth retrying; any other error is real.
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(`${API_URL}/ai/explain`, {
          signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset: symbol, timeframe: tf, snapshot }),
        }).catch(() => null);
        if (signal.aborted) return;
        if (res?.ok) {
          setWaking(false);
          setAi({ loading: false, data: await res.json() });
          return;
        }
        if (res && res.status !== 503) {
          console.error('AI summary failed:', res.status, await res.text().catch(() => ''));
          break;
        }
        setWaking(true);
        await new Promise(r => setTimeout(r, 4000));
        if (signal.aborted) return;
      }
      setWaking(false);
      setAi({ loading: false, data: null });
    })();
    return () => ctrl.abort();
  }, [symbol, tf, snapshot, usable]);

  if (!usable) {
    return (
      <Card symbol={symbol}>
        <div style={{ marginTop: 10, color: MUTED, fontSize: 14 }}>Not enough price history to summarize this chart yet.</div>
      </Card>
    );
  }

  const s = snapshot!;
  const { one, many } = s.unit;
  const dir = DIRECTION[s.trend.direction];
  const sw = SWINGS[s.swings.label];
  const pos = s.range.position;

  return (
    <Card symbol={symbol}>
      {s.sample_data && (
        <div role="note" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, border: `1px solid ${AMBER}55`, color: AMBER, fontSize: 13, lineHeight: 1.45 }}>
          Live prices for {symbol} aren't available right now, so this chart and summary are built on made-up sample data, not real prices.
        </div>
      )}

      {/* The one thing to know. */}
      <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: '#f8fafc', minHeight: 25 }}>
        {ai.data?.headline ?? (ai.loading
          ? <span style={{ color: '#64748b', fontWeight: 500, fontSize: 15 }}>{waking ? 'Waking up the AI, this can take up to a minute…' : 'Reading the chart…'}</span>
          : <span style={{ color: '#64748b', fontWeight: 500, fontSize: 14 }}>The written summary isn't available right now, but the numbers below are up to date.</span>)}
      </div>

      {/* How it got here. */}
      {ai.data?.story && (
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, color: '#cbd5e1', maxWidth: 760 }}>{ai.data.story}</p>
      )}

      {/* The facts behind it. These come straight from the chart, so they show up instantly. */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        <Tile title="Direction" info={`Compares today's price with ${s.trend.bars} ${many} ago and with its average price over that time. Small wiggles that don't add up to much count as sideways. The S&P 500 line shows how the overall US stock market did over the same ${s.trend.bars} ${many}.`}>
          <Status color={dir.color}>{dir.icon} {dir.label}</Status>
          <Line>{cap(pct(s.trend.change_pct))} over {s.trend.bars} {many}</Line>
          <Line muted>{cap(pct(s.trend.recent_change_pct))} in the last {s.trend.recent_bars} {many}</Line>
          {s.trend.market_change_pct != null && (
            <Line muted>S&amp;P 500: {pct(s.trend.market_change_pct)} over {s.trend.bars} {many}</Line>
          )}
        </Tile>

        <Tile title="Price swings" info={`How much the price moves in a typical ${one}, up or down. Bigger swings mean bigger possible gains and bigger possible losses.`}>
          <Status color={sw.color}>{sw.label}</Status>
          <Line>Moves about {s.swings.typical_move_pct.toFixed(1)}% a {one}</Line>
          <Line muted>Usually {s.swings.usual_move_pct.toFixed(1)}%</Line>
        </Tile>

        <Tile title="Where it sits" info={`Where today's price falls between the lowest and highest prices on this chart (the last ${span(s.bars, s.unit)}).`}>
          <Status color="#cbd5e1">{WHERE[s.range.where]}</Status>
          <RangeBar position={pos} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 4 }}>
            <span>{fmtPrice(s.range.low)}</span>
            <span>{fmtPrice(s.range.high)}</span>
          </div>
        </Tile>

        <Tile title="Floor & ceiling" info="Nearby prices where the chart turned around before. Traders call them support (floor) and resistance (ceiling). Prices often pause there, but they can break through.">
          <LevelRow label="Ceiling" level={s.levels.ceiling} sign="+" />
          <LevelRow label="Floor" level={s.levels.floor} sign="−" />
          <Line muted>Now {fmtPrice(s.price)}</Line>
        </Tile>
      </div>

      {ai.data && ai.data.watch.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 0.5 }}>What to watch</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
            {ai.data.watch.map((w, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: '#cbd5e1' }}>{w}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Card({ symbol, children }: { symbol: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 16, padding: 16, color: '#e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>DeltaMind's take on {symbol}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>AI summary · not financial advice</div>
      </div>
      {children}
    </div>
  );
}

function Tile({ title, info, children }: { title: string; info: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#020617', border: '1px solid #1f2a44', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 3, alignContent: 'start' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, display: 'flex', alignItems: 'center' }}>
        {title}<InfoTooltip text={info} />
      </div>
      {children}
    </div>
  );
}

function Status({ color, children }: { color: string; children: React.ReactNode }) {
  return <div style={{ fontSize: 16, fontWeight: 800, color }}>{children}</div>;
}

function Line({ muted, children }: { muted?: boolean; children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: muted ? MUTED : '#e2e8f0' }}>{children}</div>;
}

/** Low → high track with a dot at today's price. */
function RangeBar({ position }: { position: number }) {
  const left = `${Math.min(Math.max(position, 0), 1) * 100}%`;
  return (
    <div style={{ position: 'relative', height: 14, marginTop: 6 }} aria-hidden="true">
      <div style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 4, borderRadius: 2, background: '#334155' }} />
      <div style={{ position: 'absolute', top: 0, left, width: 14, height: 14, marginLeft: -7, borderRadius: '50%', background: '#f8fafc', border: '3px solid #0b1226' }} />
    </div>
  );
}

function LevelRow({ label, level, sign }: { label: string; level: Level; sign: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
      <span style={{ color: MUTED }}>{label}</span>
      {level ? (
        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
          {fmtPrice(level.price)} <span style={{ color: MUTED, fontWeight: 500 }}>{sign}{level.distance_pct.toFixed(1)}%</span>
        </span>
      ) : (
        <span style={{ color: MUTED }}>none on chart</span>
      )}
    </div>
  );
}
