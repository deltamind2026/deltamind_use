// lib/portfolio.ts

export interface Holding {
  id: string;
  symbol: string;
  shares: number;
  buyPrice: number;
  addedAt: string;
}

const KEY = 'portfolio_holdings';

export function loadHoldings(): Holding[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHoldings(holdings: Holding[]): void {
  localStorage.setItem(KEY, JSON.stringify(holdings));
}

export function addHolding(holding: Omit<Holding, 'id' | 'addedAt'>): Holding {
  const holdings = loadHoldings();
  const newHolding: Holding = {
    ...holding,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };
  saveHoldings([...holdings, newHolding]);
  return newHolding;
}

export function removeHolding(id: string): void {
  saveHoldings(loadHoldings().filter(h => h.id !== id));
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatPercent(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}