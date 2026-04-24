'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loadHoldings, addHolding, removeHolding, formatCurrency, formatPercent } from '@/lib/portfolio';
import type { Holding } from '@/lib/portfolio';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';
const STARTING_CASH = 10000;

// ---------------- Types ----------------

interface HoldingWithPrice extends Holding {
  currentPrice: number | null;
  loading: boolean;
  error: string | null;
}

interface PaperPosition {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number | null;
  loading: boolean;
}

interface PaperTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  total: number;
  timestamp: string;
}

type SortKey = string;
type SortDir = 'asc' | 'desc';

// ---------------- localStorage helpers ----------------

function loadPaperCash(): number {
  if (typeof window === 'undefined') return STARTING_CASH;
  try {
    const raw = localStorage.getItem('paper_cash');
    return raw ? parseFloat(raw) : STARTING_CASH;
  } catch { return STARTING_CASH; }
}

function savePaperCash(n: number) {
  localStorage.setItem('paper_cash', String(n));
}

function loadPaperPositions(): PaperPosition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('paper_positions');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePaperPositions(p: PaperPosition[]) {
  localStorage.setItem('paper_positions', JSON.stringify(p));
}

function loadPaperTrades(): PaperTrade[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('paper_trades');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePaperTrades(t: PaperTrade[]) {
  localStorage.setItem('paper_trades', JSON.stringify(t));
}

// ---------------- Main component ----------------

export default function PortfolioPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'holdings' | 'paper'>('holdings');

  // --- Holdings state ---
  const [holdings, setHoldings] = useState<HoldingWithPrice[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', shares: '', buyPrice: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [hSort, setHSort] = useState<{ key: SortKey; dir: SortDir }>({ key: '', dir: 'asc' });

  // --- Paper trade state ---
  const [cash, setCash] = useState<number>(STARTING_CASH);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [buyForm, setBuyForm] = useState({ symbol: '', shares: '' });
  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [buyFormError, setBuyFormError] = useState('');
  const [buyFormLoading, setBuyFormLoading] = useState(false);
  const [pSort, setPSort] = useState<{ key: SortKey; dir: SortDir }>({ key: '', dir: 'asc' });
  const [showReset, setShowReset] = useState(false);

  // ---------------- Shared: fetch price ----------------

  const fetchPrice = useCallback(async (symbol: string): Promise<number | null> => {
    try {
      const priceRes = await fetch(`${API_URL}/market/ohlc?symbol=${symbol}&tf=1d&limit=5`);
      if (!priceRes.ok) return null;
      const data = await priceRes.json();
      const candles = data.candles;
      if (!candles || candles.length === 0) return null;
      return candles[candles.length - 1].close;
    } catch { return null; }
  }, []);

  // ---------------- Holdings ----------------

  const loadAndHydrate = useCallback(async () => {
    const saved = loadHoldings();
    setHoldings(saved.map(h => ({ ...h, currentPrice: null, loading: true, error: null })));
    const withPrices = await Promise.all(
      saved.map(async h => {
        const price = await fetchPrice(h.symbol);
        return { ...h, currentPrice: price, loading: false, error: price === null ? 'Price unavailable' : null };
      })
    );
    setHoldings(withPrices);
  }, [fetchPrice]);

  useEffect(() => { loadAndHydrate(); }, [loadAndHydrate]);

  const handleAdd = async () => {
    const sym = form.symbol.trim().toUpperCase();
    const shares = parseFloat(form.shares);
    const buyPrice = parseFloat(form.buyPrice);
    if (!sym) return setFormError('Enter a ticker symbol');
    if (isNaN(shares) || shares <= 0) return setFormError('Enter a valid number of shares');
    if (isNaN(buyPrice) || buyPrice <= 0) return setFormError('Enter a valid buy price');
    setFormLoading(true);
    setFormError('');
    const price = await fetchPrice(sym);
    if (price === null) { setFormError('Symbol not found or no data available'); setFormLoading(false); return; }
    addHolding({ symbol: sym, shares, buyPrice });
    setForm({ symbol: '', shares: '', buyPrice: '' });
    setShowAdd(false);
    setFormLoading(false);
    loadAndHydrate();
  };

  const handleRemove = (id: string) => { removeHolding(id); loadAndHydrate(); };

  // holdings sort
  const sortedHoldings = [...holdings].sort((a, b) => {
    if (!hSort.key) return 0;
    let av: number, bv: number;
    if (hSort.key === 'symbol') return hSort.dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
    if (hSort.key === 'shares') { av = a.shares; bv = b.shares; }
    else if (hSort.key === 'buyPrice') { av = a.buyPrice; bv = b.buyPrice; }
    else if (hSort.key === 'currentPrice') { av = a.currentPrice ?? 0; bv = b.currentPrice ?? 0; }
    else if (hSort.key === 'totalCost') { av = a.buyPrice * a.shares; bv = b.buyPrice * b.shares; }
    else if (hSort.key === 'totalValue') { av = (a.currentPrice ?? 0) * a.shares; bv = (b.currentPrice ?? 0) * b.shares; }
    else if (hSort.key === 'gainDollar') { av = ((a.currentPrice ?? a.buyPrice) - a.buyPrice) * a.shares; bv = ((b.currentPrice ?? b.buyPrice) - b.buyPrice) * b.shares; }
    else if (hSort.key === 'gainPct') { av = a.currentPrice ? (a.currentPrice - a.buyPrice) / a.buyPrice : 0; bv = b.currentPrice ? (b.currentPrice - b.buyPrice) / b.buyPrice : 0; }
    else return 0;
    return hSort.dir === 'asc' ? av! - bv! : bv! - av!;
  });

  const toggleHSort = (key: SortKey) => {
    setHSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  // holdings totals
  const totalCost = holdings.reduce((s, h) => s + h.buyPrice * h.shares, 0);
  const totalValue = holdings.reduce((s, h) => h.currentPrice !== null ? s + h.currentPrice * h.shares : s, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // allocation
  const allocationData = holdings
    .filter(h => h.currentPrice !== null)
    .map((h, i) => ({
      symbol: h.symbol,
      value: h.currentPrice! * h.shares,
      pct: totalValue > 0 ? (h.currentPrice! * h.shares / totalValue) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));

  // ---------------- Paper trading ----------------

  useEffect(() => {
    setCash(loadPaperCash());
    setTrades(loadPaperTrades());
  }, []);

  const loadAndHydratePaper = useCallback(async () => {
    const saved = loadPaperPositions();
    setPositions(saved.map(p => ({ ...p, currentPrice: null, loading: true })));
    const withPrices = await Promise.all(
      saved.map(async p => {
        const price = await fetchPrice(p.symbol);
        return { ...p, currentPrice: price, loading: false };
      })
    );
    setPositions(withPrices);
  }, [fetchPrice]);

  useEffect(() => { loadAndHydratePaper(); }, [loadAndHydratePaper]);

  const handleBuyLookup = async () => {
    const sym = buyForm.symbol.trim().toUpperCase();
    if (!sym) return setBuyFormError('Enter a ticker symbol');
    setBuyFormLoading(true);
    setBuyFormError('');
    setBuyPrice(null);
    const price = await fetchPrice(sym);
    if (price === null) { setBuyFormError('Symbol not found or no data available'); setBuyFormLoading(false); return; }
    setBuyPrice(price);
    setBuyFormLoading(false);
  };

  const handleBuy = () => {
    const sym = buyForm.symbol.trim().toUpperCase();
    const shares = parseFloat(buyForm.shares);
    if (!sym || buyPrice === null) return;
    if (isNaN(shares) || shares <= 0) return setBuyFormError('Enter a valid number of shares');
    const total = shares * buyPrice;
    if (total > cash) return setBuyFormError(`Not enough cash. You need ${formatCurrency(total)} but have ${formatCurrency(cash)}`);

    const newCash = cash - total;
    setCash(newCash);
    savePaperCash(newCash);

    // update or create position
    const existing = loadPaperPositions();
    const idx = existing.findIndex(p => p.symbol === sym);
    let updated: PaperPosition[];
    if (idx >= 0) {
      const prev = existing[idx];
      const newShares = prev.shares + shares;
      const newAvg = (prev.avgCost * prev.shares + buyPrice * shares) / newShares;
      updated = existing.map((p, i) => i === idx ? { ...p, shares: newShares, avgCost: newAvg } : p);
    } else {
      updated = [...existing, { id: crypto.randomUUID(), symbol: sym, shares, avgCost: buyPrice, currentPrice: buyPrice, loading: false }];
    }
    savePaperPositions(updated);
    loadAndHydratePaper();

    // log trade
    const trade: PaperTrade = { id: crypto.randomUUID(), symbol: sym, action: 'BUY', shares, price: buyPrice, total, timestamp: new Date().toISOString() };
    const newTrades = [trade, ...loadPaperTrades()];
    savePaperTrades(newTrades);
    setTrades(newTrades);

    setBuyForm({ symbol: '', shares: '' });
    setBuyPrice(null);
    setBuyFormError('');
  };

  const handleSell = (position: PaperPosition) => {
    if (position.currentPrice === null) return;
    const total = position.currentPrice * position.shares;
    const newCash = cash + total;
    setCash(newCash);
    savePaperCash(newCash);

    const existing = loadPaperPositions().filter(p => p.id !== position.id);
    savePaperPositions(existing);
    loadAndHydratePaper();

    const trade: PaperTrade = { id: crypto.randomUUID(), symbol: position.symbol, action: 'SELL', shares: position.shares, price: position.currentPrice, total, timestamp: new Date().toISOString() };
    const newTrades = [trade, ...loadPaperTrades()];
    savePaperTrades(newTrades);
    setTrades(newTrades);
  };

  const handleReset = () => {
    savePaperCash(STARTING_CASH);
    savePaperPositions([]);
    savePaperTrades([]);
    setCash(STARTING_CASH);
    setPositions([]);
    setTrades([]);
    setShowReset(false);
  };

  // paper sort
  const sortedPositions = [...positions].sort((a, b) => {
    if (!pSort.key) return 0;
    let av: number, bv: number;
    if (pSort.key === 'symbol') return pSort.dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
    if (pSort.key === 'shares') { av = a.shares; bv = b.shares; }
    else if (pSort.key === 'avgCost') { av = a.avgCost; bv = b.avgCost; }
    else if (pSort.key === 'currentPrice') { av = a.currentPrice ?? 0; bv = b.currentPrice ?? 0; }
    else if (pSort.key === 'marketValue') { av = (a.currentPrice ?? 0) * a.shares; bv = (b.currentPrice ?? 0) * b.shares; }
    else if (pSort.key === 'gainDollar') { av = ((a.currentPrice ?? a.avgCost) - a.avgCost) * a.shares; bv = ((b.currentPrice ?? b.avgCost) - b.avgCost) * b.shares; }
    else if (pSort.key === 'gainPct') { av = a.currentPrice ? (a.currentPrice - a.avgCost) / a.avgCost : 0; bv = b.currentPrice ? (b.currentPrice - b.avgCost) / b.avgCost : 0; }
    else return 0;
    return pSort.dir === 'asc' ? av! - bv! : bv! - av!;
  });

  const togglePSort = (key: SortKey) => {
    setPSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  // paper totals
  const paperTotalValue = positions.reduce((s, p) => p.currentPrice !== null ? s + p.currentPrice * p.shares : s, 0);
  const paperTotalCost = positions.reduce((s, p) => s + p.avgCost * p.shares, 0);
  const paperTotalGain = paperTotalValue - paperTotalCost;
  const paperTotalGainPct = paperTotalCost > 0 ? (paperTotalGain / paperTotalCost) * 100 : 0;
  const portfolioTotal = cash + paperTotalValue;

  // ---------------- Render ----------------

  return (
    <div style={{ padding: 24, color: '#e5e7eb', display: 'grid', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>My Portfolio</div>
          <div style={{ color: '#94a3b8' }}>Track your holdings and practice trading</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'holdings' && (
            <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>+ Add Holding</button>
          )}
          {tab === 'paper' && (
            <button onClick={() => setShowReset(true)} style={btnDanger}>Reset Account</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1f2a44', paddingBottom: 0 }}>
        {(['holdings', 'paper'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
              color: tab === t ? '#e5e7eb' : '#94a3b8',
              fontWeight: tab === t ? 800 : 500,
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: -1,
            }}
          >
            {t === 'holdings' ? 'Holdings' : 'Paper Trading'}
          </button>
        ))}
      </div>

      {/* ===================== HOLDINGS TAB ===================== */}
      {tab === 'holdings' && (
        <>
          {/* Summary cards */}
          {holdings.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={card}>
                <div style={cardLabel}>TOTAL VALUE</div>
                <div style={cardValue}>{formatCurrency(totalValue)}</div>
              </div>
              <div style={card}>
                <div style={cardLabel}>TOTAL COST</div>
                <div style={cardValue}>{formatCurrency(totalCost)}</div>
              </div>
              <div style={card}>
                <div style={cardLabel}>TOTAL GAIN/LOSS</div>
                <div style={{ ...cardValue, color: totalGain >= 0 ? '#22c55e' : '#ef4444' }}>
                  {formatCurrency(totalGain)} ({formatPercent(totalGainPct)})
                </div>
              </div>
            </div>
          )}

          {/* Allocation bar */}
          {allocationData.length > 0 && (
            <div style={card}>
              <div style={cardLabel}>ALLOCATION</div>
              <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', margin: '10px 0 12px' }}>
                {allocationData.map(d => (
                  <div key={d.symbol} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.symbol}: ${d.pct.toFixed(1)}%`} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {allocationData.map(d => (
                  <div key={d.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700 }}>{d.symbol}</span>
                    <span style={{ color: '#94a3b8' }}>{d.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add form */}
          {showAdd && (
            <div style={{ ...card, maxWidth: 480 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Add a Holding</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <input placeholder="Ticker (e.g. AAPL)" value={form.symbol}
                  onChange={e => { setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() })); setFormError(''); }}
                  style={inputStyle} />
                <input placeholder="Number of shares (e.g. 10)" type="number" value={form.shares}
                  onChange={e => { setForm(f => ({ ...f, shares: e.target.value })); setFormError(''); }}
                  style={inputStyle} />
                <input placeholder="Buy price per share (e.g. 120.50)" type="number" value={form.buyPrice}
                  onChange={e => { setForm(f => ({ ...f, buyPrice: e.target.value })); setFormError(''); }}
                  style={inputStyle} />
                {formError && <div style={{ color: '#ef4444', fontSize: 12 }}>{formError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAdd} disabled={formLoading} style={btnSuccess}>
                    {formLoading ? 'Checking...' : 'Add'}
                  </button>
                  <button onClick={() => { setShowAdd(false); setFormError(''); setForm({ symbol: '', shares: '', buyPrice: '' }); }} style={btnGray}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Holdings table */}
          {holdings.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No holdings yet</div>
              <div style={{ color: '#94a3b8' }}>Add a stock above to start tracking your portfolio.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2a44', color: '#94a3b8', fontSize: 12 }}>
                    {[
                      { label: 'SYMBOL', key: 'symbol' },
                      { label: 'SHARES', key: 'shares' },
                      { label: 'BUY PRICE', key: 'buyPrice' },
                      { label: 'CURRENT', key: 'currentPrice' },
                      { label: 'TOTAL COST', key: 'totalCost' },
                      { label: 'TOTAL VALUE', key: 'totalValue' },
                      { label: 'GAIN/LOSS', key: 'gainDollar' },
                      { label: '%', key: 'gainPct' },
                      { label: '', key: '' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.key && toggleHSort(col.key)}
                        style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, cursor: col.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                      >
                        {col.label}
                        {hSort.key === col.key && <span style={{ marginLeft: 4 }}>{hSort.dir === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map(h => {
                    const gainDollar = h.currentPrice !== null ? (h.currentPrice - h.buyPrice) * h.shares : null;
                    const gainPct = h.currentPrice !== null ? ((h.currentPrice - h.buyPrice) / h.buyPrice) * 100 : null;
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '12px', fontWeight: 900 }}>{h.symbol}</td>
                        <td style={{ padding: '12px' }}>{h.shares}</td>
                        <td style={{ padding: '12px' }}>{formatCurrency(h.buyPrice)}</td>
                        <td style={{ padding: '12px' }}>
                          {h.loading ? <span style={{ color: '#94a3b8' }}>Loading...</span>
                            : h.error ? <span style={{ color: '#ef4444' }}>—</span>
                            : formatCurrency(h.currentPrice!)}
                        </td>
                        <td style={{ padding: '12px' }}>{formatCurrency(h.buyPrice * h.shares)}</td>
                        <td style={{ padding: '12px' }}>{h.currentPrice !== null ? formatCurrency(h.currentPrice * h.shares) : '—'}</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: gainDollar === null ? '#94a3b8' : gainDollar >= 0 ? '#22c55e' : '#ef4444' }}>
                          {gainDollar === null ? '—' : formatCurrency(gainDollar)}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: gainPct === null ? '#94a3b8' : gainPct >= 0 ? '#22c55e' : '#ef4444' }}>
                          {gainPct === null ? '—' : formatPercent(gainPct)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => router.push(`/dashboard/canvas?symbol=${h.symbol}`)} style={btnChart}>View Chart</button>
                            <button onClick={() => handleRemove(h.id)} style={btnRemove}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===================== PAPER TRADING TAB ===================== */}
      {tab === 'paper' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={card}>
              <div style={cardLabel}>CASH BALANCE</div>
              <div style={cardValue}>{formatCurrency(cash)}</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>POSITIONS VALUE</div>
              <div style={cardValue}>{formatCurrency(paperTotalValue)}</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>TOTAL PORTFOLIO</div>
              <div style={cardValue}>{formatCurrency(portfolioTotal)}</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>UNREALIZED P&L</div>
              <div style={{ ...cardValue, color: paperTotalGain >= 0 ? '#22c55e' : '#ef4444' }}>
                {formatCurrency(paperTotalGain)} ({formatPercent(paperTotalGainPct)})
              </div>
            </div>
          </div>

          {/* Buy form */}
          <div style={{ ...card, maxWidth: 520 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Buy Stock</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                placeholder="Ticker (e.g. NVDA)"
                value={buyForm.symbol}
                onChange={e => { setBuyForm(f => ({ ...f, symbol: e.target.value.toUpperCase() })); setBuyFormError(''); setBuyPrice(null); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={handleBuyLookup} disabled={buyFormLoading} style={btnPrimary}>
                {buyFormLoading ? 'Looking up...' : 'Look Up'}
              </button>
            </div>
            {buyPrice !== null && (
              <>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>
                  Current price: <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatCurrency(buyPrice)}</span>
                  {buyForm.shares && !isNaN(parseFloat(buyForm.shares)) && (
                    <span> — Total: <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatCurrency(parseFloat(buyForm.shares) * buyPrice)}</span></span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Number of shares"
                    type="number"
                    value={buyForm.shares}
                    onChange={e => { setBuyForm(f => ({ ...f, shares: e.target.value })); setBuyFormError(''); }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={handleBuy} style={btnSuccess}>Buy</button>
                </div>
              </>
            )}
            {buyFormError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{buyFormError}</div>}
          </div>

          {/* Reset confirm */}
          {showReset && (
            <div style={{ ...card, maxWidth: 400, borderColor: '#dc2626' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Reset paper trading account?</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>This will clear all positions, trade history, and restore your cash to $10,000. This cannot be undone.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleReset} style={btnDanger}>Yes, Reset</button>
                <button onClick={() => setShowReset(false)} style={btnGray}>Cancel</button>
              </div>
            </div>
          )}

          {/* Positions table */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Open Positions</div>
            {positions.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 32 }}>
                <div style={{ color: '#94a3b8' }}>No open positions. Look up a stock above to start trading.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2a44', color: '#94a3b8', fontSize: 12 }}>
                      {[
                        { label: 'SYMBOL', key: 'symbol' },
                        { label: 'SHARES', key: 'shares' },
                        { label: 'AVG COST', key: 'avgCost' },
                        { label: 'CURRENT', key: 'currentPrice' },
                        { label: 'MARKET VALUE', key: 'marketValue' },
                        { label: 'UNREALIZED P&L', key: 'gainDollar' },
                        { label: '%', key: 'gainPct' },
                        { label: '', key: '' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => col.key && togglePSort(col.key)}
                          style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, cursor: col.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                        >
                          {col.label}
                          {pSort.key === col.key && <span style={{ marginLeft: 4 }}>{pSort.dir === 'asc' ? '↑' : '↓'}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map(p => {
                      const gainDollar = p.currentPrice !== null ? (p.currentPrice - p.avgCost) * p.shares : null;
                      const gainPct = p.currentPrice !== null ? ((p.currentPrice - p.avgCost) / p.avgCost) * 100 : null;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #0f172a' }}>
                          <td style={{ padding: '12px', fontWeight: 900 }}>{p.symbol}</td>
                          <td style={{ padding: '12px' }}>{p.shares}</td>
                          <td style={{ padding: '12px' }}>{formatCurrency(p.avgCost)}</td>
                          <td style={{ padding: '12px' }}>
                            {p.loading ? <span style={{ color: '#94a3b8' }}>Loading...</span> : p.currentPrice !== null ? formatCurrency(p.currentPrice) : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>{p.currentPrice !== null ? formatCurrency(p.currentPrice * p.shares) : '—'}</td>
                          <td style={{ padding: '12px', fontWeight: 700, color: gainDollar === null ? '#94a3b8' : gainDollar >= 0 ? '#22c55e' : '#ef4444' }}>
                            {gainDollar === null ? '—' : formatCurrency(gainDollar)}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 700, color: gainPct === null ? '#94a3b8' : gainPct >= 0 ? '#22c55e' : '#ef4444' }}>
                            {gainPct === null ? '—' : formatPercent(gainPct)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => router.push(`/dashboard/canvas?symbol=${p.symbol}`)} style={btnChart}>View Chart</button>
                              <button onClick={() => handleSell(p)} disabled={p.currentPrice === null} style={btnDanger}>Sell</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trade history */}
          {trades.length > 0 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Trade History</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2a44', color: '#94a3b8', fontSize: 12 }}>
                      {['TIME', 'ACTION', 'SYMBOL', 'SHARES', 'PRICE', 'TOTAL'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                          {new Date(t.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: t.action === 'BUY' ? '#22c55e' : '#ef4444' }}>
                          {t.action}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 900 }}>{t.symbol}</td>
                        <td style={{ padding: '10px 12px' }}>{t.shares}</td>
                        <td style={{ padding: '10px 12px' }}>{formatCurrency(t.price)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatCurrency(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- Constants ----------------

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

// ---------------- Styles ----------------

const card: React.CSSProperties = { background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 };
const cardLabel: React.CSSProperties = { color: '#94a3b8', fontSize: 12, marginBottom: 4, fontWeight: 700 };
const cardValue: React.CSSProperties = { fontSize: 22, fontWeight: 900 };
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, background: '#020617', border: '1px solid #1f2a44', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '10px 14px', borderRadius: 12, background: '#1e40af', border: 'none', color: '#e5e7eb', fontWeight: 800, cursor: 'pointer', fontSize: 14 };
const btnSuccess: React.CSSProperties = { padding: '10px 16px', borderRadius: 8, background: '#059669', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const btnGray: React.CSSProperties = { padding: '10px 16px', borderRadius: 8, background: '#374151', border: 'none', color: '#e5e7eb', fontWeight: 700, cursor: 'pointer' };
const btnChart: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, background: '#1e3a5f', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const btnRemove: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, background: '#374151', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const btnDanger: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: '#7f1d1d', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13, fontWeight: 700 };