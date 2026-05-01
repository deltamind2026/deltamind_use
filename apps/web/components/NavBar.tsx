'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard/canvas', label: 'Canvas' },
  { href: '/dashboard/portfolio', label: 'Portfolio' },
  { href: '/dashboard/options', label: 'Options Chain' },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <nav style={{
      background: '#0b1226',
      borderBottom: '1px solid #1f2a44',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 52,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{
        color: '#e5e7eb',
        textDecoration: 'none',
        fontWeight: 900,
        fontSize: 18,
        letterSpacing: '-0.5px',
      }}>
        Delta<span style={{ color: '#3b82f6' }}>Mind</span>
      </Link>
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                color: active ? '#e5e7eb' : '#94a3b8',
                background: active ? '#1e40af' : 'transparent',
                textDecoration: 'none',
                fontWeight: active ? 800 : 500,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}