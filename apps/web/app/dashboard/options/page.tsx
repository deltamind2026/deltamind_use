
'use client';
import React, { useEffect, useState } from 'react';

export default function OptionsPage(){
  const [symbol, setSymbol] = useState('NVDA');
  const [provider, setProvider] = useState<'tradier'|'deribit'|'mock'>('tradier');
  const [chain, setChain] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(()=>{
    setErr('');
    setChain(null);
    fetch(`http://localhost:8040/options/chain?symbol=${symbol}&provider=${provider}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || 'Failed');
        return j;
      })
      .then(setChain)
      .catch(e=>setErr(String(e.message||e)));
  }, [symbol, provider]);

  return (
    <div style={{ padding: 24, color:'#e5e7eb' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Options Chain</h1>
      <p style={{ color:'#94a3b8' }}>
        Provider adapters: Tradier (equities) · Deribit (crypto). Falls back to mock if unavailable.
      </p>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop: 10 }}>
        <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={sel}>
          <option>NVDA</option><option>AAPL</option><option>TSLA</option><option>NFLX</option><option>HOOD</option><option>SPY</option><option>BTC</option><option>ETH</option>
        </select>
        <select value={provider} onChange={e=>setProvider(e.target.value as any)} style={sel}>
          <option value="tradier">tradier</option>
          <option value="deribit">deribit</option>
          <option value="mock">mock</option>
        </select>
      </div>

      <div style={card}>
        {err && <div style={{ color:'#ef4444', fontWeight: 800 }}>Error: {err}</div>}
        {!chain && !err && <div style={{ color:'#94a3b8' }}>Loading…</div>}
        {chain && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
              <div><b>Symbol:</b> {chain.symbol} · <b>Provider:</b> {chain.provider}</div>
              <div style={{ color:'#94a3b8', fontSize: 12 }}>Normalized schema: exp → strikes → (call/put) iv, oi, bid, ask</div>
            </div>

            <div style={{ maxHeight: 520, overflow:'auto', border:'1px solid #1f2a44', borderRadius: 12 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13 }}>
                <thead style={{ position:'sticky', top:0, background:'#060b18' }}>
                  <tr>
                    <th style={th}>Exp</th><th style={th}>Type</th><th style={th}>Strike</th><th style={th}>Bid</th><th style={th}>Ask</th><th style={th}>IV</th><th style={th}>OI</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.rows.slice(0, 300).map((r:any, i:number)=>(
                    <tr key={i}>
                      <td style={td}>{r.exp}</td>
                      <td style={td}>{r.type}</td>
                      <td style={td}>{r.strike}</td>
                      <td style={td}>{r.bid ?? ''}</td>
                      <td style={td}>{r.ask ?? ''}</td>
                      <td style={td}>{r.iv ? Math.round(r.iv*100)+'%' : ''}</td>
                      <td style={td}>{r.oi ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const sel:any = { padding:'10px 12px', borderRadius: 12, background:'#0b1226', border:'1px solid #1f2a44', color:'#e5e7eb', fontWeight: 800 };
const card:any = { marginTop: 12, border:'1px solid #1f2a44', borderRadius: 16, padding: 12, background:'#0b1226' };
const th:any = { textAlign:'left', padding:'10px 10px', borderBottom:'1px solid #1f2a44', color:'#cbd5e1' };
const td:any = { padding:'8px 10px', borderBottom:'1px solid #0b1020', color:'#e5e7eb' };
