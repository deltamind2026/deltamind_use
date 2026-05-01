import Link from 'next/link';

const features = [
  {
    href: '/dashboard/canvas',
    title: 'Pro Chart Canvas',
    description: 'Interactive candlestick charts with technical indicators, drawing tools, and AI-powered plain-English analysis on any stock.',
    badge: 'Live',
  },
  {
    href: '/dashboard/portfolio',
    title: 'Portfolio & Paper Trading',
    description: 'Track your real holdings with live prices and P&L, or practice buying and selling stocks with $10,000 in fake money — no risk required.',
    badge: 'New',
  },
  {
    href: '/dashboard/options',
    title: 'Options Chain',
    description: 'Explore live options contracts for any stock. View calls and puts with strike prices, expiration dates, and real market data.',
    badge: 'Live',
  },
];

export default function Home() {
  return (
    <main style={{ padding: '48px 24px', color: '#e5e7eb', maxWidth: 1100, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 12px', letterSpacing: '-1px' }}>
          Delta<span style={{ color: '#3b82f6' }}>Mind</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 18, margin: 0, maxWidth: 560 }}>
          Stock market analysis made simple. Built for investors who are just getting started.
        </p>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {features.map(f => (
          <Link
            key={f.href}
            href={f.href}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: '#0b1226',
              border: '1px solid #1f2a44',
              borderRadius: 16,
              padding: 24,
              height: '100%',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#e5e7eb' }}>{f.title}</div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: f.badge === 'New' ? '#1e3a5f' : '#052e16',
                  color: f.badge === 'New' ? '#60a5fa' : '#22c55e',
                }}>
                  {f.badge}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                {f.description}
              </p>
              <div style={{ color: '#3b82f6', fontSize: 13, fontWeight: 700, marginTop: 'auto' }}>
                Open →
              </div>
            </div>
          </Link>
        ))}
      </div>

    </main>
  );
}