
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

const links = [
  { href: '/dashboard/canvas', label: 'Canvas' },
  { href: '/dashboard/portfolio', label: 'Portfolio' },
  { href: '/dashboard/options', label: 'Options Chain' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    // Check the current user's authentication status.
    void supabase.auth.getUser()
      .then(({ data, error }) => {
        if (active) {
          setSignedIn(!error && Boolean(data.user));
          setAuthReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setSignedIn(false);
          setAuthReady(true);
        }
      });

    // Update the navigation when login status changes.
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setSignedIn(Boolean(session?.user));
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseClient();

    if (!supabase || loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setSignedIn(false);
      router.replace('/login');
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? `Logout failed: ${error.message}`
          : 'Logout failed. Please try again.'
      );
    } finally {
      setLoggingOut(false);
    }
  }

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

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
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
              }}
            >
              {link.label}
            </Link>
          );
        })}

        {authReady && (
          signedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: '#1e40af',
                color: 'white',
                border: 'none',
                cursor: loggingOut ? 'wait' : 'pointer',
                fontWeight: 700,
              }}
            >
              {loggingOut ? 'Signing Out...' : 'Logout'}
            </button>
          ) : (
            <Link
              href="/login"
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Sign In
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
