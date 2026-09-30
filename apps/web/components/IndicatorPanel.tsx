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

  const group = (level: GuideEntry['level']) => GUIDE.filter(g => g.level === level).map(g => (
    <Card key={g.key} g={g} on={settings.enabled[g.key]} reading={readings[g.key]} onToggle={() => toggle(g.key)}>
      <Params k={g.key} s={settings} set={setParams} tf={tf} />
    </Card>
  ));

  return (
    <aside style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
      <div style={{ padding: '2px 4px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#f1f5f9' }}>Chart helpers</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2, lineHeight: 1.45 }}>
          Turn one on to add it to the chart. Each one tells you what it's showing right now.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 14, padding: '10px 12px' }}>
        <Toggle on={settings.beginnerMode} onClick={() => onChange(setBeginnerMode(settings, !settings.beginnerMode))} label="Beginner Mode" />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#e5e7eb' }}>Beginner Mode</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Hides Normal range, Momentum and Momentum shifts</div>
        </div>
      </div>
      <GroupLabel>Start here</GroupLabel>
      {group('basic')}
      <GroupLabel>When you're ready for more</GroupLabel>
      {group('more')}
    </aside>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: '#64748b', padding: '6px 4px 0' }}>{children}</div>;
}

function Card({ g, on, reading, onToggle, children }: {
  g: GuideEntry; on: boolean; reading?: Reading | null; onToggle: () => void; children: React.ReactNode;
}) {
  const tone = TONE[reading?.tone || 'neutral'];
  return (
    <div style={{ background: '#0b1226', border: `1px solid ${on ? '#334155' : '#1f2a44'}`, borderRadius: 14, padding: 12, color: '#e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Toggle on={on} onClick={onToggle} label={g.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{g.name}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{g.technical}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, opacity: on ? 1 : 0.35 }}>
          {swatches(g.key).map((s, i) => <Swatch key={i} color={s.color} dashed={s.dashed} />)}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.45 }}>{g.what}</div>

      {on && reading && (
        <div style={{ marginTop: 10, background: tone.bg, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#64748b' }}>Right now</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: tone.color, marginTop: 2 }}>{reading.headline}</div>
          {reading.detail && <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 3, lineHeight: 1.45 }}>{reading.detail}</div>}
        </div>
      )}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>How to read it</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
          {g.howToRead.map(t => <li key={t}>{t}</li>)}
        </ul>
        {children}
      </details>
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
