'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '@/lib/data';
import { elapsedSeconds, loadActives } from '@/lib/local';
import { hms } from '@/lib/format';
import type { ActiveSession } from '@/lib/types';
import AuthForm, { NewPasswordForm } from './AuthForm';
import WelcomeTour from './WelcomeTour';
import Landing from './Landing';

const NAV = [
  { href: '/', label: 'Inicio', d: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { href: '/stats', label: 'Estadísticas', d: 'M5 20V11M12 20V4M19 20v-6' },
  { href: '/history', label: 'Historial', d: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/social', label: 'Social', d: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8' },
  { href: '/goals', label: 'Objetivos', d: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01' },
  { href: '/settings', label: 'Ajustes', d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
];

function ActivePill() {
  const pathname = usePathname();
  const [actives, setActives] = useState<ActiveSession[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = () => {
      setActives(loadActives());
      setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // En Inicio las sesiones en curso ya se ven en "Jugando ahora"; en /session está la propia pantalla.
  if (actives.length === 0 || pathname === '/session' || pathname === '/') return null;
  const one = actives.length === 1 ? actives[0] : null;
  const allPaused = actives.every((a) => a.paused_at != null);
  return (
    <Link href={one ? `/session?id=${one.id}` : '/session'} className={`pill ${allPaused ? 'paused' : ''}`}>
      <span>{one ? (allPaused ? 'Sesión en pausa' : 'Sesión en curso') : `${actives.length} sesiones en curso`}</span>
      {one && <span className="num">{hms(elapsedSeconds(one, now))}</span>}
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const d = useData();
  const pathname = usePathname();
  const [entry, setEntry] = useState<'in' | 'up' | null>(null); // null = ver la landing

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

  if (!d.user) {
    // La landing solo se ve en la portada y en el navegador; la app instalada va directa al acceso.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (pathname === '/' && !standalone && entry === null) return <Landing onEnter={setEntry} />;
    return <AuthForm initialMode={entry === 'up' ? 'up' : 'in'} onBack={pathname === '/' && !standalone ? () => setEntry(null) : undefined} />;
  }
  if (d.recovery) return <NewPasswordForm />;

  return (
    <>
      <WelcomeTour />
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
