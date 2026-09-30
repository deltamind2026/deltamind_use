'use client';
import React from 'react';
import type { IndicatorKey, IndicatorSettings } from '@/lib/ta/settings';
import { setBeginnerMode } from '@/lib/ta/settings';
import { GUIDE, swatches, type GuideEntry, type Reading, type Tone } from '@/lib/ta/guide';
import { Swatch } from './ProChart';

const TONE: Record<Tone, { color: string; bg: string }> = {
  up: { color: '#4ade80', bg: 'rgba(34,197,94,0.08)' },
  down: { color: '#f87171', bg: 'rgba(239,68,68,0.08)' },
  neutral: { color: '#e2e8f0', bg: 'rgba(148,163,184,0.08)' },
};

export default function IndicatorPanel({
  settings, onChange, readings, tf,
}: {
  settings: IndicatorSettings;
  onChange: (s: IndicatorSettings) => void;
  readings: Partial<Record<IndicatorKey, Reading | null>>;
  tf: string;
}) {
  const toggle = (k: IndicatorKey) => onChange({ ...settings, enabled: { ...settings.enabled, [k]: !settings.enabled[k] } });
  const setParams = <K extends IndicatorKey>(k: K, v: Partial<IndicatorSettings['params'][K]>) =>
    onChange({ ...settings, params: { ...settings.params, [k]: { ...settings.params[k], ...v } } });

  // Only one helper is expanded at a time so the panel stays short.
  const [open, setOpen] = React.useState<IndicatorKey | null>(null);

  const group = (level: GuideEntry['level']) => (
    <div style={{ background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 14, overflow: 'hidden' }}>
      {GUIDE.filter(g => g.level === level).map((g, i) => (
        <Row key={g.key} g={g} first={i === 0} on={settings.enabled[g.key]} reading={readings[g.key]}
          expanded={open === g.key} onExpand={() => setOpen(open === g.key ? null : g.key)} onToggle={() => toggle(g.key)}>
          <Params k={g.key} s={settings} set={setParams} tf={tf} />
        </Row>
      ))}
    </div>
  );

  return (
    <aside className="dm-helpers" style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
      <style>{`
        @media (min-width: 1101px) {
          .dm-helpers { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 4px' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#f1f5f9' }}>Chart helpers</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Tap a name to learn what it means.</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#cbd5e1', cursor: 'pointer' }}
          title="Hides Normal range, Momentum, Average price paid and Momentum shifts">
          Beginner
          <Toggle on={settings.beginnerMode} onClick={() => onChange(setBeginnerMode(settings, !settings.beginnerMode))} label="Beginner Mode" />
        </label>
      </div>
      <GroupLabel>Start here</GroupLabel>
      {group('basic')}
      <GroupLabel>When you're ready for more</GroupLabel>
      {group('more')}
    </aside>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: '#64748b', padding: '4px 4px 0' }}>{children}</div>;
}

function Row({ g, first, on, reading, expanded, onExpand, onToggle, children }: {
  g: GuideEntry; first: boolean; on: boolean; reading?: Reading | null;
  expanded: boolean; onExpand: () => void; onToggle: () => void; children: React.ReactNode;
}) {
  const tone = TONE[reading?.tone || 'neutral'];
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid #1f2a44', color: '#e5e7eb', background: expanded ? '#0e1630' : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
        <Toggle on={on} onClick={onToggle} label={g.name} />
        <button onClick={onExpand} aria-expanded={expanded} style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
          padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap' }}>{g.name}</span>
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.technical}</span>
            </div>
            {on && reading && (
              <div style={{ fontSize: 12, fontWeight: 700, color: tone.color, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {reading.headline}
              </div>
            )}
          </div>
          <span style={{ display: 'flex', gap: 3, opacity: on ? 1 : 0.35 }}>
            {swatches(g.key).map((s, i) => <Swatch key={i} color={s.color} dashed={s.dashed} bar={s.bar} />)}
          </span>
          <span style={{ color: '#64748b', fontSize: 10, transform: `rotate(${expanded ? 90 : 0}deg)`, transition: 'transform .15s' }}>▶</span>
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px 56px', fontSize: 12.5, lineHeight: 1.5 }}>
          <div style={{ color: '#94a3b8' }}>{g.what}</div>
          {on && reading?.detail && (
            <div style={{ marginTop: 8, background: tone.bg, borderRadius: 8, padding: '6px 8px', color: '#cbd5e1' }}>
              <b style={{ color: tone.color }}>Right now:</b> {reading.detail}
            </div>
          )}
          <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#cbd5e1' }}>
            {g.howToRead.map(t => <li key={t}>{t}</li>)}
          </ul>
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={`Show ${label}`} onClick={onClick} style={{
      width: 34, height: 20, borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer', flexShrink: 0,
      background: on ? '#2563eb' : '#334155', transition: 'background .15s',
    }}>
      <span style={{ display: 'block', width: 16, height: 16, borderRadius: 999, background: '#fff', transform: `translateX(${on ? 14 : 0}px)`, transition: 'transform .15s' }} />
    </button>
  );
}

/* ---------------- optional fine-tuning ---------------- */

function Params({ k, s, set, tf }: { k: IndicatorKey; s: IndicatorSettings; set: (k: any, v: any) => void; tf: string }) {
  const p = s.params;
  const u = tf === '1D' ? 'days' : 'candles';
  let fields: React.ReactNode = null;
  switch (k) {
    case 'TREND':
      fields = <>
        <Num label={`Short line (${u})`} value={p.TREND.fast} onChange={v => set('TREND', { fast: v })} />
        <Num label={`Long line (${u})`} value={p.TREND.slow} onChange={v => set('TREND', { slow: v })} />
        <label style={fieldLabel}>
          Style
          <select value={p.TREND.kind} onChange={e => set('TREND', { kind: e.target.value })} style={input}>
            <option value="simple">Simple average (SMA)</option>
            <option value="exponential">Weights recent prices more (EMA)</option>
          </select>
        </label>
      </>;
      break;
    case 'RANGE':
      fields = <>
        <Num label={`Look-back (${u})`} value={p.RANGE.period} onChange={v => set('RANGE', { period: v })} />
        <Num label="Band width" step={0.5} value={p.RANGE.stdev} onChange={v => set('RANGE', { stdev: v })} />
      </>;
      break;
    case 'VOLUME':
      fields = <Num label={`Compare to average of (${u})`} value={p.VOLUME.avg} onChange={v => set('VOLUME', { avg: v })} />;
      break;
    case 'MOMENTUM':
      fields = <Num label={`Look-back (${u})`} value={p.MOMENTUM.period} onChange={v => set('MOMENTUM', { period: v })} />;
      break;
    case 'MACD':
      fields = <>
        <Num label="Fast" value={p.MACD.fast} onChange={v => set('MACD', { fast: v })} />
        <Num label="Slow" value={p.MACD.slow} onChange={v => set('MACD', { slow: v })} />
        <Num label="Signal" value={p.MACD.signal} onChange={v => set('MACD', { signal: v })} />
      </>;
      break;
  }
  if (!fields) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #1f2a44' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Fine-tune (optional, the defaults are what most people use)</div>
      <div style={{ display: 'grid', gap: 6 }}>{fields}</div>
    </div>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={fieldLabel}>
      {label}
      <input type="number" value={value} step={step} min={step < 1 ? step : 2} onChange={e => onChange(Number(e.target.value))} style={{ ...input, width: 72 }} />
    </label>
  );
}

const fieldLabel: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' };
const input: React.CSSProperties = { padding: '5px 8px', borderRadius: 8, background: '#020617', border: '1px solid #1f2a44', color: '#e5e7eb', fontSize: 12 };
