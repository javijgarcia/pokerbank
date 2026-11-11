'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import BalanceCards from '@/components/BalanceCards';
import NowPlaying from '@/components/NowPlaying';
import UpcomingTournaments from '@/components/UpcomingTournaments';
import SessionRow from '@/components/SessionRow';
import { Card, Field, parseNum } from '@/components/ui';

function FirstBank() {
  const { addBank } = useData();
  const [name, setName] = useState('Principal');
  const [initial, setInitial] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(await addBank(name.trim() || 'Principal', parseNum(initial) ?? 0));
    setBusy(false);
  }

  return (
    <Card title="Empieza aquí">
      <p className="muted small">
        Crea tu primera bolsa de bankroll. Luego podrás añadir más (cash, torneos, live, online…) en Ajustes.
      </p>
      <form className="stack" onSubmit={submit}>
        <Field label="Nombre">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Saldo inicial (€)">
          <input className="input" inputMode="decimal" placeholder="0" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </Field>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>
          Crear bolsa
        </button>
      </form>
    </Card>
  );
}

export default function Home() {
  const d = useData();

  const recent = useMemo(() => {
    const ids = new Set(d.scopeBanks.map((b) => b.id));
    return d.sessions
      .filter((s) => ids.has(s.bank_id))
      .sort((a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime())
      .slice(0, 5);
  }, [d.scopeBanks, d.sessions]);

  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name;

  if (!d.loading && d.banks.length === 0) {
    return (
      <>
        <h1>PokerBank</h1>
        <FirstBank />
      </>
    );
  }

  return (
    <>
      <BalanceCards />
      <NowPlaying />
      <UpcomingTournaments />
      <Link href="/icm" className="card row between" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span>
          <strong>Calculadora de ICM</strong>
          <span className="small muted" style={{ display: 'block' }}>
            Valor en € de cada stack según los premios
          </span>
        </span>
        <span className="muted" aria-hidden>›</span>
      </Link>
      <Card
        title="Historial"
        action={
          <Link href="/history" className="small muted">
            Ver todo
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="muted small">Todavía no has registrado sesiones.</p>
        ) : (
          <div className="list">
            {recent.map((s) => (
              <SessionRow key={s.id} s={s} bankName={d.banks.length > 1 ? bankName(s.bank_id) : undefined} pending={d.pendingIds.has(s.id)} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
