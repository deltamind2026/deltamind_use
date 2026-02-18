
'use client';
import React, { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, IndicatorSettings, loadSettings, saveSettings } from '@/lib/ta/settings';

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

      <Row label="SMA">
        <input type="checkbox" checked={s.enabled.SMA} onChange={e=>upd({...s, enabled:{...s.enabled, SMA:e.target.checked}})} />
        <Num label="Period" value={s.params.SMA.period} onChange={v=>upd({...s, params:{...s.params, SMA:{period:v}}})} />
      </Row>

      <Row label="VWAP">
        <input type="checkbox" checked={s.enabled.VWAP} onChange={e=>upd({...s, enabled:{...s.enabled, VWAP:e.target.checked}})} />
        <span style={hint}>Session VWAP</span>
      </Row>

      <Row label="Bollinger">
        <input type="checkbox" checked={s.enabled.BOLL} onChange={e=>upd({...s, enabled:{...s.enabled, BOLL:e.target.checked}})} />
        <Num label="Period" value={s.params.BOLL.period} onChange={v=>upd({...s, params:{...s.params, BOLL:{...s.params.BOLL, period:v}}})} />
        <Num label="σ" step={0.1} value={s.params.BOLL.stdev} onChange={v=>upd({...s, params:{...s.params, BOLL:{...s.params.BOLL, stdev:v}}})} />
      </Row>

      <Row label="RSI">
        <input type="checkbox" checked={s.enabled.RSI} onChange={e=>upd({...s, enabled:{...s.enabled, RSI:e.target.checked}})} />
        <Num label="Period" value={s.params.RSI.period} onChange={v=>upd({...s, params:{...s.params, RSI:{period:v}}})} />
      </Row>

      <Row label="MACD">
        <input type="checkbox" checked={s.enabled.MACD} onChange={e=>upd({...s, enabled:{...s.enabled, MACD:e.target.checked}})} />
        <Num label="Fast" value={s.params.MACD.fast} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, fast:v}}})} />
        <Num label="Slow" value={s.params.MACD.slow} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, slow:v}}})} />
        <Num label="Signal" value={s.params.MACD.signal} onChange={v=>upd({...s, params:{...s.params, MACD:{...s.params.MACD, signal:v}}})} />
      </Row>

      <Row label="Volume Profile">
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
