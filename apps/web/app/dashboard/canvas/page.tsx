'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import IndicatorPanel from '@/components/IndicatorPanel';
import ProChart from '@/components/ProChart';
import AiInsight from '@/components/AiInsight';
import type { ChartType, IndicatorKey, IndicatorSettings } from '@/lib/ta/settings';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings } from '@/lib/ta/settings';
import { GUIDE, computeIndicators, fmtPrice, readIndicator, summarize } from '@/lib/ta/guide';
import { API_URL, useChartData } from '@/lib/useChartData';

const DEFAULT_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'NFLX', 'HOOD', 'SPY'];

const TIMEFRAMES = [
  { value: '1D', label: 'Daily' },
  { value: '4H', label: '4 hours' },
  { value: '1H', label: '1 hour' },
  { value: '15m', label: '15 min' },
];

function CanvasPageInner(){
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(() => searchParams.get('symbol') || 'NVDA');
  const [tf, setTf] = useState('1D');
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [showManageStocks, setShowManageStocks] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [searchError, setSearchError] = useState('');

  const data = useChartData(symbol, tf);

  // Settings are stored exactly as typed; the chart always uses a cleaned-up copy.
  useEffect(() => { setSettings(loadSettings()); }, []);
  const updateSettings = (s: IndicatorSettings) => { setSettings(s); saveSettings(s); };
  const clean = useMemo(() => sanitizeSettings(settings), [settings]);

  const computed = useMemo(
    () => (data.bars.length ? computeIndicators(data.bars, clean) : null),
    // only the params affect the math; toggling an indicator shouldn't recompute everything
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.bars, JSON.stringify(clean.params)]
  );
  const readings = useMemo(() => {
    const out: Partial<Record<IndicatorKey, ReturnType<typeof readIndicator>>> = {};
    if (computed) for (const g of GUIDE) out[g.key] = readIndicator(g.key, data.bars, computed, clean, tf);
    return out;
  }, [computed, data.bars, clean, tf]);
  const summary = useMemo(() => summarize(data.bars, tf), [data.bars, tf]);

  // Load custom symbols from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customSymbols');
    if (saved) {
      try {
        setCustomSymbols(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save custom symbols to localStorage
  const saveCustomSymbols = (symbols: string[]) => {
    setCustomSymbols(symbols);
    localStorage.setItem('customSymbols', JSON.stringify(symbols));
  };

  // Add new symbol
  const handleAddSymbol = async () => {
    const sym = newSymbol.trim().toUpperCase();

    if (!sym) {
      setSearchError('Please enter a symbol');
      return;
    }

    if (DEFAULT_SYMBOLS.includes(sym) || customSymbols.includes(sym)) {
      setSearchError('Symbol already in list');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/market/ohlc?symbol=${sym}&tf=1D&limit=1`);

      if (!res.ok) {
        setSearchError('Symbol not found or invalid');
        return;
      }

      const data = await res.json();

      if (!data.candles || data.candles.length === 0) {
        setSearchError('No data available for this symbol');
        return;
      }

      saveCustomSymbols([...customSymbols, sym]);
      setSymbol(sym);
      setNewSymbol('');
      setShowAddSymbol(false);
      setSearchError('');
    } catch (err) {
      setSearchError('Error validating symbol');
    }
  };

  // Remove custom symbol
  const handleRemoveSymbol = (sym: string) => {
    saveCustomSymbols(customSymbols.filter(s => s !== sym));
    if (symbol === sym) {
      setSymbol('NVDA');
    }
  };

  // Clear all custom symbols
  const handleClearAll = () => {
    saveCustomSymbols([]);
    if (!DEFAULT_SYMBOLS.includes(symbol)) {
      setSymbol('NVDA');
    }
    setShowManageStocks(false);
  };

  const up = (summary?.change ?? 0) >= 0;
  const periodUp = (summary?.periodChange ?? 0) >= 0;

  return (
    <div style={{ padding: '20px 24px 32px', color:'#e5e7eb', display:'grid', gap:16, maxWidth: 1600, margin: '0 auto' }}>
      <style>{`
        .dm-canvas-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
        @media (max-width: 1100px) { .dm-canvas-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* Header: what am I looking at, and how is it doing? */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={sel} aria-label="Stock">
              {DEFAULT_SYMBOLS.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
              {customSymbols.length > 0 && <option disabled>──────────</option>}
              {customSymbols.map(sym => (
                <option key={sym} value={sym}>★ {sym}</option>
              ))}
            </select>
            <button onClick={() => setShowAddSymbol(!showAddSymbol)} style={ghostBtn}>+ Add stock</button>
            {customSymbols.length > 0 && (
              <button onClick={() => setShowManageStocks(!showManageStocks)} style={ghostBtn}>
                Manage ({customSymbols.length})
              </button>
            )}
          </div>
          {summary ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5 }}>{fmtPrice(summary.price)}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: up ? '#22c55e' : '#ef4444' }}>
                {up ? '▲' : '▼'} {Math.abs(summary.change).toFixed(2)}%
              </span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>
                {periodUp ? 'Up' : 'Down'} <b style={{ color: periodUp ? '#4ade80' : '#f87171' }}>{Math.abs(summary.periodChange).toFixed(1)}%</b> {summary.periodLabel}
                {' · '}range {fmtPrice(summary.low)} – {fmtPrice(summary.high)}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: data.status === 'error' ? '#f87171' : '#64748b', minHeight: 41, display: 'flex', alignItems: 'center' }}>
              {data.status === 'error' ? `Couldn't load ${symbol}. Is the market service running?` : `Loading ${symbol}…`}
            </div>
          )}
        </div>

        <div role="group" aria-label="Timeframe" style={{ display: 'inline-flex', background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 12, padding: 3 }}>
          {TIMEFRAMES.map(t => (
            <button key={t.value} onClick={() => setTf(t.value)} style={{
              padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
              background: tf === t.value ? '#1e3a8a' : 'transparent', color: tf === t.value ? '#e0e7ff' : '#94a3b8',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Add Symbol Modal */}
      {showAddSymbol && (
        <div style={{
          background: '#0b1226',
          border: '1px solid #1f2a44',
          borderRadius: 12,
          padding: 16,
          maxWidth: 400
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Add Custom Stock</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={newSymbol}
              onChange={e => {
                setNewSymbol(e.target.value.toUpperCase());
                setSearchError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleAddSymbol()}
              placeholder="Enter symbol (e.g., GOOGL)"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#020617',
                border: '1px solid #1f2a44',
                color: '#e5e7eb',
                fontSize: 14
              }}
            />
            <button
              onClick={handleAddSymbol}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: '#059669',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddSymbol(false);
                setNewSymbol('');
                setSearchError('');
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: '#374151',
                border: 'none',
                color: '#e5e7eb',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
          {searchError && (
            <div style={{ color: '#ef4444', fontSize: 12 }}>{searchError}</div>
          )}
        </div>
      )}

      {/* Manage Stocks Modal */}
      {showManageStocks && customSymbols.length > 0 && (
        <div style={{
          background: '#0b1226',
          border: '1px solid #1f2a44',
          borderRadius: 12,
          padding: 16,
          maxWidth: 500
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Your Custom Stocks ({customSymbols.length})
            </div>
            <button
              onClick={handleClearAll}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: '#dc2626',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              Clear All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customSymbols.map(sym => (
              <div
                key={sym}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#020617',
                  border: '1px solid #1f2a44',
                  borderRadius: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>★ {sym}</span>
                  {symbol === sym && (
                    <span style={{
                      fontSize: 11,
                      color: '#22c55e',
                      background: '#022c22',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#374151',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowManageStocks(false)}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#374151',
              border: 'none',
              color: '#e5e7eb',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Done
          </button>
        </div>
      )}

      <div className="dm-canvas-grid">
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <ProChart
            symbol={symbol}
            tf={tf}
            bars={data.bars}
            computed={computed}
            settings={clean}
            marketState={data.marketState}
            onChartType={(chartType: ChartType) => updateSettings({ ...settings, chartType })}
          />
          {data.status === 'ready' && (
            <AiInsight symbol={symbol} tf={tf} candles={data.candles} marketState={data.marketState} />
          )}
        </div>
        <IndicatorPanel settings={settings} onChange={updateSettings} readings={readings} tf={tf} />
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense>
      <CanvasPageInner />
    </Suspense>
  );
}

const sel: React.CSSProperties = {
  padding:'8px 12px',
  borderRadius: 10,
  background:'#0b1226',
  border:'1px solid #1f2a44',
  color:'#e5e7eb',
  fontWeight: 900,
  fontSize: 16,
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  background: 'transparent',
  border: '1px solid #1f2a44',
  color: '#cbd5e1',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
