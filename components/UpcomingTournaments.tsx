'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useData } from '@/lib/data';
import { eur } from '@/lib/format';
import { Card } from './ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Próximos torneos del calendario (los tres siguientes). */
export default function UpcomingTournaments() {
  const d = useData();
  const next = useMemo(() => {
    const from = Date.now() - 3_600_000;
    return d.scheduled.filter((t) => new Date(t.starts_at).getTime() >= from).slice(0, 3);
  }, [d.scheduled]);

  return (
    <Card
      title="Próximos torneos"
      action={
        <Link href="/calendar" className="small muted">
          Calendario
        </Link>
      }
    >
      {next.length === 0 ? (
        <p className="muted small">Sin torneos programados. Añádelos en el calendario para tenerlos a mano y exportarlos a tu agenda.</p>
      ) : (
        <div className="list">
          {next.map((t) => (
            <Link key={t.id} href="/calendar" className="item">
              <div style={{ minWidth: 0 }}>
                <strong>{t.name}</strong>
                <div className="small muted">
                  {when(t.starts_at)} · {t.place || (t.venue === 'live' ? 'Live' : 'Online')}
                </div>
              </div>
              <div className="num">{eur(t.buy_in)}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
