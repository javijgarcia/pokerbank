'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { activeFromScheduled } from '@/lib/active';
import { downloadIcs } from '@/lib/ics';
import { upsertActive } from '@/lib/local';
import { eur } from '@/lib/format';
import type { ScheduledTournament, Venue } from '@/lib/types';
import { Card, Field, Segmented, parseNum } from '@/components/ui';
import { IconGlobe, IconPin } from '@/components/icons';

const VENUE_OPTS = [
  { value: 'online' as const, label: 'Online', icon: <IconGlobe /> },
  { value: 'live' as const, label: 'Live', icon: <IconPin /> },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function defaultStart(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CalendarPage() {
  const d = useData();
  const router = useRouter();
  const banks = d.banks.filter((b) => !b.archived);
  const [name, setName] = useState('');
  const [bankId, setBankId] = useState('');
  const [venue, setVenue] = useState<Venue>('online');
  const [place, setPlace] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [bounty, setBounty] = useState(false);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const from = Date.now() - 3_600_000;
    const all = [...d.scheduled].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return {
      upcoming: all.filter((t) => new Date(t.starts_at).getTime() >= from),
      past: all.filter((t) => new Date(t.starts_at).getTime() < from).reverse(),
    };
  }, [d.scheduled]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const bi = parseNum(buyIn);
    const bank = bankId || banks[0]?.id;
    const ts = new Date(startsAt).getTime();
    if (!name.trim()) return setErr('Ponle un nombre al torneo.');
    if (bi == null || bi <= 0) return setErr('Indica el buy-in.');
    if (!bank) return setErr('Primero crea una bolsa.');
    if (!Number.isFinite(ts)) return setErr('La fecha no es válida.');
    setBusy(true);
    const e2 = await d.addScheduled({
      bank_id: bank,
      name: name.trim(),
      venue,
      place: place.trim() || null,
      buy_in: bi,
      has_bounty: bounty,
      starts_at: new Date(ts).toISOString(),
      notes: notes.trim() || null,
    });
    setBusy(false);
    setErr(e2);
    if (!e2) {
      setName('');
      setNotes('');
      setBuyIn('');
      setBounty(false);
    }
  }

  async function startNow(t: ScheduledTournament) {
    upsertActive(activeFromScheduled(t));
    await d.deleteScheduled(t.id); // ya lo vas a jugar: sale del calendario
    router.push('/');
  }

  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name;

  const row = (t: ScheduledTournament, isPast: boolean) => (
    <div className="item" key={t.id} style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <strong>{t.name}</strong>
        <div className="small muted">
          {when(t.starts_at)} · {t.place || (t.venue === 'live' ? 'Live' : 'Online')}
          {d.banks.length > 1 && ` · ${bankName(t.bank_id) ?? ''}`}
        </div>
        <div className="tiny muted">
          Buy-in {eur(t.buy_in)}
          {t.has_bounty && ' · bounty (KO)'}
          {t.notes && ` · ${t.notes}`}
        </div>
      </div>
      <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
        {!isPast && (
          <button className="btn btn-sm btn-primary" onClick={() => startNow(t)}>
            Empezar ahora
          </button>
        )}
        <button className="btn btn-sm" onClick={() => downloadIcs([t], `${t.name}.ics`)}>
          A mi agenda
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => window.confirm('¿Borrar este torneo del calendario?') && void d.deleteScheduled(t.id)}
        >
          Borrar
        </button>
      </div>
    </div>
  );

  return (
    <>
      <h1>Calendario</h1>
      <Card
        title="Próximos torneos"
        action={
          upcoming.length > 0 ? (
            <button className="btn btn-sm" onClick={() => downloadIcs(upcoming)}>
              Exportar todos (.ics)
            </button>
          ) : undefined
        }
      >
        {upcoming.length === 0 ? <p className="muted small">No hay torneos programados.</p> : <div className="list">{upcoming.map((t) => row(t, false))}</div>}
        <p className="tiny muted">El archivo .ics se abre con Google Calendar, Apple Calendar u Outlook e incluye un aviso 30 minutos antes.</p>
      </Card>

      <Card title="Programar un torneo">
        <form className="stack" onSubmit={add}>
          <Field label="Nombre">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Million, Turbo del jueves…" />
          </Field>
          {banks.length > 1 && (
            <Field label="Bolsa">
              <select className="input" value={bankId || banks[0]?.id} onChange={(e) => setBankId(e.target.value)}>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Segmented value={venue} options={VENUE_OPTS} onChange={setVenue} />
          <Field label="Sala / lugar (opcional)">
            <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} />
          </Field>
          <Field label="Buy-in (€)">
            <input className="input" inputMode="decimal" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
          </Field>
          <Field label="Fecha y hora">
            <input className="input" type="datetime-local" style={{ maxWidth: '100%', minWidth: 0 }} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <label className="row small" style={{ gap: 10 }}>
            <input type="checkbox" checked={bounty} onChange={(e) => setBounty(e.target.checked)} />
            Torneo con bounty (KO)
          </label>
          <Field label="Notas (opcional)">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Late reg hasta el nivel 10…" />
          </Field>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Añadir al calendario'}
          </button>
        </form>
      </Card>

      {past.length > 0 && (
        <details>
          <summary className="small muted">Pasados sin jugar ({past.length})</summary>
          <Card>
            <div className="list">{past.map((t) => row(t, true))}</div>
          </Card>
        </details>
      )}
    </>
  );
}
