import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 24, color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>DeltaMind v5.2</h1>
      <p style={{ color: '#94a3b8', maxWidth: 900 }}>
        Pro chart engine (drawings + indicator settings + volume profile) and real options chain adapters (Tradier + Deribit).
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <Link href="/dashboard/canvas" style={btn}>Canvas (Bypass Mode)</Link>
        <Link href="/dashboard/options" style={btn}>Options Chain (Bypass Mode)</Link>
      </div>
    </main>
  );
}

const btn: any = {
  padding: '10px 14px',
  borderRadius: 12,
  background: '#0b1226',
  border: '1px solid #1f2a44',
  color: '#e5e7eb',
  textDecoration: 'none',
  fontWeight: 800
};
