'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '@/lib/data';
import { elapsedSeconds, loadActive } from '@/lib/local';
import { hms } from '@/lib/format';
import type { ActiveSession } from '@/lib/types';
import AuthForm from './AuthForm';

const NAV = [
  { href: '/', label: 'Inicio', d: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { href: '/stats', label: 'Estadísticas', d: 'M5 20V11M12 20V4M19 20v-6' },
  { href: '/history', label: 'Historial', d: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/goals', label: 'Objetivos', d: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01' },
  { href: '/settings', label: 'Ajustes', d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
];

function ActivePill() {
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = () => {
      setActive(loadActive());
      setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // En Inicio la sesión en curso ya se ve en "Jugando ahora"; en /session está la propia pantalla.
  if (!active || pathname === '/session' || pathname === '/') return null;
  const paused = active.paused_at != null;
  return (
    <Link href="/session" className={`pill ${paused ? 'paused' : ''}`}>
      <span>{paused ? 'Sesión en pausa' : 'Sesión en curso'}</span>
      <span className="num">{hms(elapsedSeconds(active, now))}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const d = useData();
  const pathname = usePathname();

  if (!d.configured) {
    return (
      <main className="center">
        <h1>Falta configurar Supabase</h1>
        <p className="muted">
          Copia <code>.env.local.example</code> a <code>.env.local</code>, rellena{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, y ejecuta{' '}
          <code>supabase/schema.sql</code> en el SQL Editor de tu proyecto.
        </p>
      </main>
    );
  }

  if (!d.authReady) {
    return (
      <main className="center">
        <p className="muted">Cargando…</p>
      </main>
    );
  }

  if (!d.user) return <AuthForm />;

  return (
    <>
      <div className="shell">
        <ActivePill />
        {d.offline && (
          <div className="notice">
            Sin conexión. Puedes seguir registrando sesiones; se sincronizarán al volver a tener red.
          </div>
        )}
        {d.pendingIds.size > 0 && !d.offline && (
          <div className="notice">Sincronizando {d.pendingIds.size} sesión(es) pendiente(s)…</div>
        )}
        {children}
      </div>
      <nav className="nav" aria-label="Principal">
        <ul>
          {NAV.map((n) => {
            const current = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={current ? 'page' : undefined}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d={n.d} />
                  </svg>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
