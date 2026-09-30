'use client';
import React, { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, IndicatorSettings, loadSettings, saveSettings, setBeginnerMode } from '@/lib/ta/settings';

export default function IndicatorPanel({ onChange }:{ onChange:(s:IndicatorSettings)=>void }) {
  const [s, setS] = useState<IndicatorSettings>(DEFAULT_SETTINGS);

  useEffect(()=>{
    const loaded = loadSettings();
    setS(loaded);
    onChange(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upd(next:IndicatorSettings){
    setS(next);
    saveSettings(next);
    onChange(next);
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Indicators</div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 8,
        borderRadius: 10,
        background: '#020617',
        border: '1px solid #1f2a44',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Beginner Mode</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Hides Bollinger, MACD and RSI by default</div>
        </div>
        <input
          type="checkbox"
          checked={s.beginnerMode}
          onChange={e => upd(setBeginnerMode(s, e.target.checked))}
        />
      </div>

      <Row label="SMA">
        <Swatch color="#facc15" />
        <input type="checkbox" checked={s.enabled.SMA} onChange={e=>upd({...s, enabled:{...s.enabled, SMA:e.target.checked}})} />
        <Num label="Period" value={s.params.SMA.period} onChange={v=>upd({...s, params:{...s.params, SMA:{period:v}}})} />
      </Row>

      <Row label="VWAP">
        <Swatch color="#a78bfa" />
        <input type="checkbox" checked={s.enabled.VWAP} onChange={e=>upd({...s, enabled:{...s.enabled, VWAP:e.target.checked}})} />
        <span style={hint}>Session VWAP</span>
      </Row>

      <Row label="Bollinger">
        <Swatch color="#94a3b8" dotted />
        <input type="checkbox" checked={s.enabled.BOLL} onChange={e=>upd({...s, enabled:{...s.enabled, BOLL:e.target.checked}})} />
        <Num label="Period" value={s.params.BOLL.period} onChange={v=>upd({...s, params:{...s.params, BOLL:{...s.params.BOLL, period:v}}})} />
        <Num label="sigma" step={0.1} value={s.params.BOLL.stdev} onChange={v=>upd({...s, params:{...s.params, BOLL:{...s.params.BOLL, stdev:v}}})} />
      </Row>

      <Row label="EMA Stack">
        <Swatch color="#22c55e" />
        <Swatch color="#60a5fa" />
        <Swatch color="#f59e0b" />
        <Swatch color="#ef4444" />
        <input type="checkbox" checked={s.enabled.EMA} onChange={e=>upd({...s, enabled:{...s.enabled, EMA:e.target.checked}})} />
        <span style={hint}>9 / 21 / 50 / 200</span>
      </Row>

      <Row label="RSI">
        <Swatch color="#a78bfa" />
        <input type="checkbox" checked={s.enabled.RSI} onChange={e=>upd({...s, enabled:{...s.enabled, RSI:e.target.checked}})} />
        <Num label="Period" value={s.params.RSI.period} onChange={v=>upd({...s, params:{...s.params, RSI:{period:v}}})} />
      </Row>

      <Row label="MACD">
        <Swatch color="#22c55e" />
        <Swatch color="#ef4444" />
        <input type="checkbox" checked={s.enabled.MACD} onChange={e=>upd({...s, enabled:{...s.enabled, MACD:e.target.checked}})} />
        <Num label="Fast" value={s.params.MACD.fast} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, fast:v}}})} />
        <Num label="Slow" value={s.params.MACD.slow} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, slow:v}}})} />
        <Num label="Signal" value={s.params.MACD.signal} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, signal:v}}})} />
      </Row>

      <Row label="Volume Profile">
        <Swatch color="#22c55e" />
        <input type="checkbox" checked={s.enabled.VOLUME_PROFILE} onChange={e=>upd({...s, enabled:{...s.enabled, VOLUME_PROFILE:e.target.checked}})} />
        <Num label="Bin $" value={s.params.VOLUME_PROFILE.binSize} onChange={v=>upd({...s, params:{...s.params, VOLUME_PROFILE:{binSize:v}}})} />
      </Row>

      <div style={{ marginTop: 8, fontSize: 12, color:'#94a3b8' }}>
        Saved per browser (students can switch to cloud-synced layouts later).
      </div>
    </div>
  );
}

function Row({ label, children }:{ label:string; children: React.ReactNode }){
  return (
    <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:10, alignItems:'center', padding:'8px 0', borderTop:'1px solid #1f2a44' }}>
      <div style={{ color:'#cbd5e1', fontWeight: 800 }}>{label}</div>
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>{children}</div>
    </div>
  );
}
function Swatch({ color, dotted=false }:{ color:string; dotted?:boolean }){
  return (
    <span
      style={{
        width: 18,
        height: 3,
        borderRadius: 2,
        background: dotted ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color,
        flexShrink: 0,
      }}
    />
  );
}
function Num({ label, value, onChange, step=1 }:{ label:string; value:number; onChange:(v:number)=>void; step?:number }){
  return (
    <label style={{ display:'flex', gap:6, alignItems:'center', color:'#94a3b8', fontSize: 12 }}>
      {label}
      <input
        type="number"
        value={value}
        step={step}
        onChange={e=>onChange(Number(e.target.value))}
        style={{ width: 80, padding:'6px 8px', borderRadius: 10, background:'#060b18', border:'1px solid #1f2a44', color:'#e5e7eb' }}
      />
    </label>
  );
}
const card:any = { border:'1px solid #1f2a44', borderRadius: 16, padding: 12, background:'#0b1226', color:'#e5e7eb' };
const hint:any = { fontSize: 12, color:'#94a3b8' };
