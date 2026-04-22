
'use client';
import React, { useState } from 'react';
import IndicatorPanel from '@/components/IndicatorPanel';
import ProChart from '@/components/ProChart';
import type { IndicatorSettings } from '@/lib/ta/settings';
import { DEFAULT_SETTINGS } from '@/lib/ta/settings';

export default function CanvasPage(){
  const [symbol, setSymbol] = useState('NVDA');
  const [tf, setTf] = useState('1D');
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);

  return (
    <div style={{ padding: 24, color:'#e5e7eb', display:'grid', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Pro Chart Canvas</div>
          <div style={{ color:'#94a3b8' }}>Drawings + indicator config + volume profile</div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={sel}>
            <option>NVDA</option><option>AAPL</option><option>TSLA</option><option>NFLX</option><option>HOOD</option><option>SPY</option>
          </select>
          <select value={tf} onChange={e=>setTf(e.target.value)} style={sel}>
            <option value="1D">1D</option><option value="4H">4H</option><option value="1H">1H</option><option value="15m">15m</option>
          </select>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:12 }}>
        <IndicatorPanel onChange={setSettings} />
        <ProChart symbol={symbol} tf={tf} settings={settings} />
      </div>

      <div style={{ fontSize: 12, color:'#94a3b8' }}>
        Tip: use Trendline/Fib tools (top-left of chart) → drag to draw. Indicators persist in localStorage.
      </div>
    </div>
  );
}
const sel:any = { padding:'10px 12px', borderRadius: 12, background:'#0b1226', border:'1px solid #1f2a44', color:'#e5e7eb', fontWeight: 800 };
