'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import IndicatorPanel from '@/components/IndicatorPanel';
import ProChart from '@/components/ProChart';
import type { IndicatorSettings } from '@/lib/ta/settings';
import { DEFAULT_SETTINGS } from '@/lib/ta/settings';

const DEFAULT_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'NFLX', 'HOOD', 'SPY'];

export default function CanvasPage(){
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(() => searchParams.get('symbol') || 'NVDA');
  const [tf, setTf] = useState('1D');
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [showManageStocks, setShowManageStocks] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [searchError, setSearchError] = useState('');

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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';
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

  const allSymbols = [...DEFAULT_SYMBOLS, ...customSymbols];

  return (
    <div style={{ padding: 24, color:'#e5e7eb', display:'grid', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            Pro Chart Canvas — <span style={{ color: '#60a5fa' }}>{symbol}</span>
          </div>
          <div style={{ color:'#94a3b8' }}>Drawings + indicator config + volume profile</div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={sel}>
            {DEFAULT_SYMBOLS.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
            {customSymbols.length > 0 && <option disabled>──────────</option>}
            {customSymbols.map(sym => (
              <option key={sym} value={sym}>★ {sym}</option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowAddSymbol(!showAddSymbol)}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: '#1e40af',
              border: 'none',
              color: '#e5e7eb',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            + Add Stock
          </button>

          {customSymbols.length > 0 && (
            <button 
              onClick={() => setShowManageStocks(!showManageStocks)}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: '#374151',
                border: 'none',
                color: '#e5e7eb',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Manage ({customSymbols.length})
            </button>
          )}

          <select value={tf} onChange={e=>setTf(e.target.value)} style={sel}>
            <option value="1D">1D</option>
            <option value="4H">4H</option>
            <option value="1H">1H</option>
            <option value="15m">15m</option>
          </select>
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

const sel: any = { 
  padding:'10px 12px', 
  borderRadius: 12, 
  background:'#0b1226', 
  border:'1px solid #1f2a44', 
  color:'#e5e7eb', 
  fontWeight: 800 
};