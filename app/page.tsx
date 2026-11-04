'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { balanceSeries, computeStats, computeStreaks, moodBreakdown, totalBalance } from '@/lib/calc';
import { eur, hoursLabel, monthKey, monthLabel, monthRange, pct, signedEur } from '@/lib/format';
import BankChart from '@/components/BankChart';
import BankFilter from '@/components/BankFilter';
import SessionRow from '@/components/SessionRow';
import TournamentStats from '@/components/TournamentStats';
import { Card, Field, Stat, parseNum, tone } from '@/components/ui';

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

export default function Dashboard() {
  const d = useData();
  const [period, setPeriod] = useState<string>('all');
  const banks = d.scopeBanks;

  const scopeSessions = useMemo(() => {
    const ids = new Set(banks.map((b) => b.id));
    return d.sessions.filter((s) => ids.has(s.bank_id));
  }, [banks, d.sessions]);

  const months = useMemo(() => {
    const ids = new Set(banks.map((b) => b.id));
    const set = new Set<string>([monthKey(new Date())]);
    scopeSessions.forEach((s) => set.add(monthKey(s.ended_at)));
    d.movements.filter((m) => ids.has(m.bank_id)).forEach((m) => set.add(monthKey(m.occurred_at)));
    return [...set].sort().reverse();
  }, [banks, scopeSessions, d.movements]);

  const range = period === 'all' ? undefined : monthRange(period);
  const series = useMemo(
    () => balanceSeries(banks, d.movements, d.sessions, range),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banks, d.movements, d.sessions, period]
  );

  const periodSessions = useMemo(
    () => (period === 'all' ? scopeSessions : scopeSessions.filter((s) => monthKey(s.ended_at) === period)),
    [scopeSessions, period]
  );
  const stats = useMemo(() => computeStats(periodSessions), [periodSessions]);
  const moods = useMemo(() => moodBreakdown(periodSessions), [periodSessions]);
  const streaks = useMemo(() => computeStreaks(scopeSessions), [scopeSessions]);
  const balance = totalBalance(banks, d.movements, d.sessions);
  const recent = [...scopeSessions].reverse().slice(0, 4);
  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name;

  if (!d.loading && d.banks.length === 0) {
    return (
      <>
        <h1>PokerBank</h1>
        <FirstBank />
      </>
    );
  }

  const maxAbs = Math.max(1, ...moods.map((m) => Math.abs(m.perHour)));

  return (
    <>
      <BankFilter />

      <section className="card hero">
        <div className="muted small">Bankroll {d.filter === 'all' ? 'total' : bankName(d.filter)}</div>
        <div className="big num">{eur(balance)}</div>
        <div className={`small num ${tone(series.end - series.start)}`}>
          {signedEur(Math.round((series.end - series.start) * 100) / 100)}{' '}
          <span className="muted">{period === 'all' ? 'desde el inicio' : `en ${monthLabel(period).toLowerCase()}`}</span>
        </div>

        <div className="row" style={{ marginTop: 6 }}>
          <select className="input" style={{ minHeight: 38, padding: '6px 10px', fontSize: 14 }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Periodo">
            <option value="all">Todo el histórico</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <BankChart series={series} />
      </section>

      <Link href="/session" className="btn btn-primary btn-block">
        Nueva sesión
      </Link>

      <Card title={period === 'all' ? 'Estadísticas' : `Estadísticas · ${monthLabel(period)}`}>
        <div className="stats">
          <Stat label="Sesiones" value={String(stats.count)} />
          <Stat label="Tiempo" value={hoursLabel(stats.seconds)} />
          <Stat label="€/hora" value={signedEur(stats.perHour)} className={tone(stats.perHour)} />
          <Stat label="Resultado" value={signedEur(stats.profit)} className={tone(stats.profit)} />
          <Stat label="ROI" value={pct(stats.roi, 1)} className={tone(stats.roi)} />
          <Stat label="ITM" value={stats.itm == null ? '—' : pct(stats.itm)} />
        </div>
        {streaks.current.type && (
          <p className="small">
            Racha actual:{' '}
            <strong className={streaks.current.type === 'win' ? 'pos' : 'neg'}>
              {streaks.current.count} {streaks.current.type === 'win' ? 'ganada' : 'perdida'}
              {streaks.current.count > 1 ? 's' : ''}
            </strong>
            <span className="muted">
              {' '}
              · mejor {streaks.bestWin} ganadas · peor {streaks.worstLoss} perdidas
            </span>
          </p>
        )}
        {(stats.avgMood != null || stats.avgPlay != null) && (
          <p className="small muted">
            Ánimo medio {stats.avgMood?.toFixed(1) ?? '—'}/5 · Juego medio {stats.avgPlay?.toFixed(1) ?? '—'}/5
          </p>
        )}
      </Card>

      <TournamentStats sessions={periodSessions} title={period === 'all' ? 'Torneos' : `Torneos · ${monthLabel(period)}`} />

      {moods.length > 0 && (
        <Card title="€/hora según tu estado mental">
          <div className="stack">
            {moods.map((m) => (
              <div key={m.mood} className="row small">
                <span style={{ width: 54 }}>Ánimo {m.mood}</span>
                <div className="bar grow">
                  <i style={{ width: `${(Math.abs(m.perHour) / maxAbs) * 100}%`, background: m.perHour >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
                </div>
                <span className={`num ${tone(m.perHour)}`} style={{ width: 78, textAlign: 'right' }}>
                  {signedEur(m.perHour)}/h
                </span>
                <span className="muted tiny" style={{ width: 28, textAlign: 'right' }}>
                  n={m.count}
                </span>
              </div>
            ))}
          </div>
          <p className="tiny muted">Con pocas sesiones por nivel, estos números son ruido; úsalos como tendencia.</p>
        </Card>
      )}

      <Card
        title="Últimas sesiones"
        action={
          <Link href="/history" className="small muted">
            Ver todas
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
