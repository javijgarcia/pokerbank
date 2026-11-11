'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { levelAdvice, lastStakeFor, bankBalance } from '@/lib/calc';
import { eur, hms, uuid } from '@/lib/format';
import { activeFromPreset, activeTitle, bountySum } from '@/lib/active';
import { elapsedSeconds, loadActives, pauseActive, removeActive, resumeActive, upsertActive } from '@/lib/local';
import { DEFAULT_BUYINS, DEFAULT_LADDER, type ActiveSession, type GameType, type LevelRule, type Preset, type Session, type Venue } from '@/lib/types';
import { Card, Field, Rating, Segmented, parseNum } from '@/components/ui';
import { activeSub, stakeLabel } from '@/components/SessionRow';
import QuickNotes from '@/components/QuickNotes';
import { IconCash, IconGlobe, IconPin, IconTrophy } from '@/components/icons';
import { uploadReceipt } from '@/lib/receipts';
import { publishSession, useMyProfile } from '@/lib/social';

interface Setup {
  bankId: string;
  gameType: GameType;
  venue: Venue;
  place: string;
  tournamentName: string;
  bounty: boolean;
  stake: string;
  buyIn: string;
}

/**
 * Nivel y buy-in a partir del formulario.
 * Cash: el nivel (NL) se pone aparte y el buy-in por defecto es ese nivel.
 * Torneo: no hay campo de ABI; el buy-in inicial es el nivel (ABI de esa sesión).
 */
function resolveSetup(s: Setup): { stake: number | null; buyIn: number | null } {
  const stake = parseNum(s.stake);
  const bi = parseNum(s.buyIn);
  if (s.gameType === 'tournament') return { stake: bi, buyIn: bi };
  return { stake, buyIn: bi ?? stake };
}

const GAME_OPTS = [
  { value: 'cash' as const, label: 'Cash', icon: <IconCash /> },
  { value: 'tournament' as const, label: 'Torneo', icon: <IconTrophy /> },
];
const VENUE_OPTS = [
  { value: 'online' as const, label: 'Online', icon: <IconGlobe /> },
  { value: 'live' as const, label: 'Live', icon: <IconPin /> },
];

// ───────────── Hora de inicio ─────────────

/** Valor de un <input type="datetime-local"> para un instante dado, en hora local. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const AGO = [
  { label: 'Ahora', min: 0 },
  { label: 'Hace 30 min', min: 30 },
  { label: 'Hace 1 h', min: 60 },
  { label: 'Hace 2 h', min: 120 },
];

/** Instante elegido: '' = ahora. null si la fecha no es válida o está en el futuro. */
function resolveStart(value: string): number | null {
  if (!value) return Date.now();
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts > Date.now() + 60_000) return null;
  return ts;
}

/** Para sesiones que se empiezan a registrar después de haber sentado a jugar. */
function StartTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="stack">
      <div className="chips" aria-label="Hora de inicio" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
        {AGO.map((o) => (
          <button key={o.label} type="button" className="chip" aria-pressed={o.min === 0 ? value === '' : false} onClick={() => onChange(o.min === 0 ? '' : toLocalInput(Date.now() - o.min * 60_000))}>
            {o.label}
          </button>
        ))}
      </div>
      <Field label="O elige la hora exacta">
        <input className="input" type="datetime-local" style={{ maxWidth: '100%', minWidth: 0 }} max={toLocalInput(Date.now())} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
      <p className="tiny muted">{value ? 'El temporizador cuenta desde esa hora.' : 'Empieza a contar ahora.'}</p>
    </div>
  );
}

// ───────────── Campos de configuración (inicio y registro manual) ─────────────

function SetupFields({ value, onChange }: { value: Setup; onChange: (p: Partial<Setup>) => void }) {
  const d = useData();
  const banks = d.banks.filter((b) => !b.archived);
  const bank = d.banks.find((b) => b.id === value.bankId);
  const rule: Pick<LevelRule, 'buyins' | 'down_buyins' | 'ladder'> =
    d.rules.find((r) => r.bank_id === value.bankId && r.game_type === value.gameType) ?? {
      ...DEFAULT_BUYINS[value.gameType],
      ladder: DEFAULT_LADDER[value.gameType],
    };
  const balance = bank ? bankBalance(bank, d.movements, d.sessions) : 0;
  const advice = levelAdvice(
    balance,
    { id: '', bank_id: value.bankId, game_type: value.gameType, ...rule },
    lastStakeFor(d.sessions, value.bankId, value.gameType)
  );
  const isTournament = value.gameType === 'tournament';
  const stakeNum = resolveSetup(value).stake;
  const needed = stakeNum != null ? stakeNum * rule.buyins : null;
  const over = needed != null && needed > balance + 1e-9;

  return (
    <div className="stack">
      {banks.length > 1 && (
        <Field label="Bolsa">
          <select className="input" value={value.bankId} onChange={(e) => onChange({ bankId: e.target.value })}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {eur(bankBalance(b, d.movements, d.sessions))}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Segmented value={value.gameType} options={GAME_OPTS} onChange={(gameType) => onChange({ gameType, stake: '', buyIn: '', tournamentName: '', bounty: false })} />
      <Segmented value={value.venue} options={VENUE_OPTS} onChange={(venue) => onChange({ venue })} />
      <Field label="Sala / lugar (opcional)">
        <input className="input" value={value.place} onChange={(e) => onChange({ place: e.target.value })} placeholder={value.venue === 'live' ? 'Casino, club…' : 'PokerStars, GGPoker…'} />
      </Field>

      {isTournament && (
        <>
          <Field label="Nombre del torneo (opcional)">
            <input className="input" value={value.tournamentName} onChange={(e) => onChange({ tournamentName: e.target.value })} placeholder="Sunday Million, Turbo del jueves…" />
          </Field>
          <label className="row small" style={{ gap: 10 }}>
            <input type="checkbox" checked={value.bounty} onChange={(e) => onChange({ bounty: e.target.checked })} />
            Torneo con bounty (KO)
          </label>
        </>
      )}

      {!isTournament && (
        <Field label="Nivel (NL) — buy-in de 100 ciegas, en €">
          <input className="input" inputMode="decimal" value={value.stake} onChange={(e) => onChange({ stake: e.target.value })} placeholder={advice.current ? String(advice.current) : ''} />
        </Field>
      )}
      <div className="chips" aria-label={isTournament ? 'Buy-ins habituales' : 'Niveles'}>
        {rule.ladder.map((l) => (
          <button
            key={l}
            type="button"
            className="chip"
            aria-pressed={stakeNum === l}
            onClick={() => onChange(isTournament ? { buyIn: String(l) } : { stake: String(l) })}
          >
            {isTournament ? eur(l) : `NL${l}`}
          </button>
        ))}
      </div>
      {advice.recommended != null ? (
        <p className="small muted">
          Con {eur(balance)} tu gestión permite hasta {stakeLabel(value.gameType, advice.recommended)}.
        </p>
      ) : (
        <p className="small warn">Tu bankroll actual no cubre ni el nivel más bajo de tu escalera.</p>
      )}
      {over && needed != null && (
        <div className="notice">
          Estás por encima de tu gestión: {isTournament ? 'este buy-in' : 'este nivel'} pide al menos {eur(needed)} ({rule.buyins} {isTournament ? 'ABIs' : 'buy-ins'}) y tienes {eur(balance)}.
        </div>
      )}
      <Field label="Buy-in inicial (€)">
        <input
          className="input"
          inputMode="decimal"
          value={value.buyIn}
          onChange={(e) => onChange({ buyIn: e.target.value })}
          placeholder={isTournament ? (advice.recommended != null ? String(advice.recommended) : '0') : value.stake || '0'}
        />
      </Field>
    </div>
  );
}

// ───────────── Cierre / registro manual ─────────────

interface EditorBase {
  setup: Setup;
  buyInTotal: string;
  entries: number;
  startedAt: number;
  endedAt: number;
  durationMin: string;
  bountyAmount?: string; // bounties apuntados durante la sesión
  bountyCount?: number;
  outcome?: 'bust' | 'win' | null;
}

function SessionEditor({
  manual,
  base,
  onCancel,
  onSaved,
}: {
  manual: boolean;
  base: EditorBase;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const d = useData();
  const [setup, setSetup] = useState<Setup>(base.setup);
  const [buyInTotal, setBuyInTotal] = useState(base.buyInTotal);
  const [cashOut, setCashOut] = useState('');
  const [durationMin, setDurationMin] = useState(base.durationMin);
  const [date, setDate] = useState(() => {
    const dt = new Date(base.startedAt);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    return dt.toISOString().slice(0, 16);
  });
  const [position, setPosition] = useState(base.outcome === 'win' ? '1' : '');
  const [players, setPlayers] = useState('');
  const [bountyAmt, setBountyAmt] = useState(base.bountyAmount ?? '');
  const [bountyCnt, setBountyCnt] = useState(base.bountyCount ? String(base.bountyCount) : '');
  const [mood, setMood] = useState<number | null>(null);
  const [play, setPlay] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState(base.outcome === 'win' ? 'ganado' : base.outcome === 'bust' ? 'busteado' : '');
  const isT = setup.gameType === 'tournament';
  const hasBounty = isT && setup.bounty;
  const [receipt, setReceipt] = useState<File | null>(null);
  const myProfile = useMyProfile(d.user?.id);
  const [publish, setPublish] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const prize = parseNum(cashOut);
    const bAmt = hasBounty ? parseNum(bountyAmt) ?? 0 : 0;
    const bCnt = hasBounty ? Math.round(parseNum(bountyCnt) ?? 0) : 0;
    if (bAmt < 0 || bCnt < 0) return setErr('Los bounties no pueden ser negativos.');
    const co = prize == null ? null : Math.round((prize + bAmt) * 100) / 100; // cash_out = premio + bounties
    const resolved = resolveSetup(setup);
    const bi = manual ? resolved.buyIn : parseNum(buyInTotal);
    // Al cerrar una sesión en curso, el nivel viene de la sesión (buyInTotal incluye recompras).
    const stake = manual ? resolved.stake : parseNum(setup.stake);
    const dur = parseNum(durationMin);
    if (co == null || prize == null || prize < 0) return setErr(isT ? 'Indica el premio (sin bounties), 0 si no has cobrado.' : 'Indica cuánto te llevas (cash-out), 0 si has perdido todo.');
    if (bi == null || bi <= 0) return setErr('Indica el buy-in total (mayor que 0).');
    if (dur == null || dur < 0) return setErr('Indica una duración válida en minutos.');
    if (!setup.bankId) return setErr('Elige una bolsa.');

    const startedAt = manual ? new Date(date).getTime() : base.startedAt;
    if (!Number.isFinite(startedAt)) return setErr('La fecha no es válida.');
    const endedAt = manual ? startedAt + dur * 60_000 : base.endedAt;

    const id = uuid();
    let receiptPath: string | null = null;
    if (receipt && d.user) {
      if (!navigator.onLine) {
        setErr('Sin conexión: no se puede subir el recibo ahora. Quita la foto o guarda cuando tengas red.');
        return;
      }
      setBusy(true);
      try {
        receiptPath = await uploadReceipt(d.user.id, id, receipt);
      } catch (e) {
        setBusy(false);
        return setErr(`No se pudo subir el recibo: ${(e as Error).message}`);
      }
    }
    const s: Session = {
      id,
      receipt_path: receiptPath,
      bank_id: setup.bankId,
      game_type: setup.gameType,
      venue: setup.venue,
      place: setup.place.trim() || null,
      tournament_name: setup.gameType === 'tournament' ? setup.tournamentName.trim() || null : null,
      has_bounty: hasBounty,
      bounty_total: bAmt,
      bounty_count: bCnt,
      stake,
      buy_in: bi,
      cash_out: co,
      entries: base.entries,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_seconds: Math.round(dur * 60),
      mood,
      play_quality: play,
      notes: notes.trim() || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      players: setup.gameType === 'tournament' ? (parseNum(players) != null ? Math.round(parseNum(players) as number) : null) : null,
      position: setup.gameType === 'tournament' ? (parseNum(position) != null ? Math.round(parseNum(position) as number) : null) : null,
    };
    setBusy(true);
    await d.saveSession(s);
    if (publish && myProfile) await publishSession(s); // si falla, se puede publicar luego desde el Historial
    setBusy(false);
    onSaved();
  }

  return (
    <>
      {manual && (
        <Card title="Datos de la sesión">
          <SetupFields value={setup} onChange={(p) => setSetup((s) => ({ ...s, ...p }))} />
          <Field label="Inicio">
            <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </Card>
      )}

      <Card title="Resultado">
        {!manual && (
          <Field label="Buy-in total (€) — incluye recompras">
            <input className="input" inputMode="decimal" value={buyInTotal} onChange={(e) => setBuyInTotal(e.target.value)} />
          </Field>
        )}
        <Field label={isT ? (hasBounty ? 'Premio, sin contar bounties (€)' : 'Premio (€)') : 'Cash-out (€)'}>
          <input className="input" inputMode="decimal" autoFocus={!manual} value={cashOut} onChange={(e) => setCashOut(e.target.value)} placeholder="0" />
        </Field>
        {isT && <p className="tiny muted">Si el premio es mayor que 0 cuenta como ITM en tus estadísticas (los bounties no cuentan para el ITM).</p>}
        {hasBounty && (
          <div className="row">
            <div className="grow">
              <Field label="Bounties ganados (€)">
                <input className="input" inputMode="decimal" value={bountyAmt} onChange={(e) => setBountyAmt(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <div className="grow">
              <Field label="Eliminaciones">
                <input className="input" inputMode="numeric" value={bountyCnt} onChange={(e) => setBountyCnt(e.target.value)} placeholder="0" />
              </Field>
            </div>
          </div>
        )}
        <Field label="Duración (minutos)">
          <input className="input" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
        </Field>
        {setup.gameType === 'tournament' && (
          <div className="row">
            <div className="grow">
              <Field label="Puesto">
                <input className="input" inputMode="numeric" value={position} onChange={(e) => setPosition(e.target.value)} />
              </Field>
            </div>
            <div className="grow">
              <Field label="Jugadores">
                <input className="input" inputMode="numeric" value={players} onChange={(e) => setPlayers(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </Card>

      <Card title="Cómo ha ido">
        <Field label="Estado mental">
          <Rating value={mood} onChange={setMood} low="tilteado / cansado" high="fino y centrado" />
        </Field>
        <Field label="Cómo has jugado (decisiones, no resultado)">
          <Rating value={play} onChange={setPlay} low="mal" high="muy bien" />
        </Field>
        <Field label="Notas">
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Manos a revisar, lecturas, tilt…" />
        </Field>
        <Field label="Etiquetas (separadas por comas)">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        {myProfile && (
          <label className="row small" style={{ gap: 10 }}>
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publicar en el feed de mis amigos (solo ROI %, tiempo y resultado, sin euros)
          </label>
        )}
        <Field label="Recibo (foto, opcional)">
          <input className="input" type="file" accept="image/*" aria-label="Foto del recibo" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
        </Field>
      </Card>

      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy} onClick={save}>
        {busy ? 'Guardando…' : 'Guardar sesión'}
      </button>
      <button className="btn btn-ghost btn-block" onClick={onCancel}>
        {manual ? 'Cancelar' : 'Volver a la sesión'}
      </button>
    </>
  );
}

// ───────────── Página ─────────────

export default function SessionPage() {
  const d = useData();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [actives, setActives] = useState<ActiveSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startNew, setStartNew] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<'main' | 'close' | 'manual'>('main');
  const [closeAt, setCloseAt] = useState(0);
  const [rebuy, setRebuy] = useState('');
  const [showRebuy, setShowRebuy] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [startAt, setStartAt] = useState(''); // '' = ahora
  const [editStart, setEditStart] = useState<string | null>(null); // edición de la hora de inicio de la sesión abierta
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const firstBank = d.banks.find((b) => !b.archived);
  const [setup, setSetup] = useState<Setup>({ bankId: '', gameType: 'cash', venue: 'online', place: '', tournamentName: '', bounty: false, stake: '', buyIn: '' });

  // Sesión que se está viendo: la elegida, o la única abierta si no se pidió empezar otra.
  const active = actives.find((a) => a.id === selectedId) ?? (!startNew && actives.length === 1 ? actives[0] : null);

  useEffect(() => {
    const list = loadActives();
    setActives(list);
    // Enlaces desde Inicio:
    //   /session?close=ID  abre el cierre de esa sesión
    //   /session?id=ID     abre esa sesión
    //   /session?type=cash|tournament  empieza una sesión nueva con ese tipo
    const q = new URLSearchParams(window.location.search);
    const closeParam = q.get('close');
    const idParam = q.get('id');
    const type = q.get('type');
    if (closeParam) {
      const target = list.find((a) => a.id === closeParam) ?? (list.length === 1 ? list[0] : null);
      if (target) {
        setSelectedId(target.id);
        setCloseAt(target.paused_at ?? Date.now());
        setView('close');
      }
    } else if (idParam && list.some((a) => a.id === idParam)) {
      setSelectedId(idParam);
    } else if (type === 'cash' || type === 'tournament') {
      setStartNew(true);
      setSetup((s) => ({ ...s, gameType: type, stake: '', buyIn: '', tournamentName: '', bounty: false }));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!setup.bankId && firstBank) {
      setSetup((s) => ({ ...s, bankId: d.filter !== 'all' && d.banks.some((b) => b.id === d.filter) ? d.filter : firstBank.id }));
    }
  }, [firstBank, setup.bankId, d.filter, d.banks]);

  if (!loaded) return null;

  if (d.banks.length === 0) {
    return (
      <>
        <h1>Sesión</h1>
        <Card>
          <p className="muted">Primero crea una bolsa de bankroll en Inicio o en Ajustes.</p>
        </Card>
      </>
    );
  }

  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name;

  function update(next: ActiveSession) {
    setActives(upsertActive(next));
  }

  function discard(id: string) {
    setActives(removeActive(id));
  }

  function begin(a: ActiveSession) {
    update(a);
    setSelectedId(a.id);
    setStartNew(false);
    setShowRebuy(false);
    setView('main');
  }

  function start() {
    const { stake, buyIn } = resolveSetup(setup);
    if (!setup.bankId) return setErr('Elige una bolsa.');
    if (buyIn == null || buyIn <= 0) return setErr(setup.gameType === 'tournament' ? 'Indica el buy-in inicial.' : 'Indica el nivel o el buy-in inicial.');
    const ts = resolveStart(startAt);
    if (ts == null) return setErr('La hora de inicio no es válida o está en el futuro.');
    setErr(null);
    begin({
      id: uuid(),
      bank_id: setup.bankId,
      game_type: setup.gameType,
      venue: setup.venue,
      place: setup.place.trim(),
      tournament_name: setup.gameType === 'tournament' ? setup.tournamentName.trim() : '',
      has_bounty: setup.gameType === 'tournament' && setup.bounty,
      bounties: [],
      stake,
      buy_in: buyIn,
      entries: 1,
      started_at: ts,
      paused_total_ms: 0,
      paused_at: null,
    });
    setStartAt('');
  }

  function startFromPreset(p: Preset) {
    const ts = resolveStart(startAt);
    if (ts == null) return setErr('La hora de inicio no es válida o está en el futuro.');
    const a = activeFromPreset(p, ts);
    if (!a) return setErr('Este preset no tiene buy-in. Bórralo y vuelve a crearlo.');
    setErr(null);
    begin(a);
    setStartAt('');
  }

  async function saveAsPreset() {
    const { stake, buyIn } = resolveSetup(setup);
    if (!presetName.trim()) return setPresetMsg('Ponle un nombre al preset.');
    if (!setup.bankId) return setPresetMsg('Elige una bolsa.');
    if (buyIn == null || buyIn <= 0) return setPresetMsg('Indica el nivel o el buy-in antes de guardarlo.');
    const e = await d.savePreset({
      bank_id: setup.bankId,
      name: presetName.trim(),
      game_type: setup.gameType,
      venue: setup.venue,
      place: setup.place.trim() || null,
      tournament_name: setup.gameType === 'tournament' ? setup.tournamentName.trim() || null : null,
      has_bounty: setup.gameType === 'tournament' && setup.bounty,
      stake,
      buy_in: buyIn,
    });
    setPresetMsg(e ?? 'Preset guardado');
    if (!e) setPresetName('');
  }

  // ── Cierre de una sesión en curso ──
  if (view === 'close' && active) {
    const secs = elapsedSeconds(active, closeAt);
    return (
      <>
        <h1>Cerrar sesión</h1>
        <SessionEditor
          manual={false}
          base={{
            setup: {
              bankId: active.bank_id,
              gameType: active.game_type,
              venue: active.venue,
              place: active.place,
              tournamentName: active.tournament_name ?? '',
              bounty: !!active.has_bounty,
              stake: active.stake != null ? String(active.stake) : '',
              buyIn: String(active.buy_in),
            },
            bountyAmount: bountySum(active) > 0 ? String(bountySum(active)) : '',
            bountyCount: (active.bounties ?? []).length,
            outcome: active.outcome ?? null,
            buyInTotal: String(active.buy_in),
            entries: active.entries,
            startedAt: active.started_at,
            endedAt: closeAt,
            durationMin: String(Math.max(1, Math.round(secs / 60))),
          }}
          onCancel={() => setView('main')}
          onSaved={() => {
            discard(active.id);
            router.push('/');
          }}
        />
      </>
    );
  }

  // ── Registro manual de una sesión ya jugada ──
  if (view === 'manual') {
    return (
      <>
        <h1>Registrar sesión pasada</h1>
        <SessionEditor
          manual
          base={{ setup, buyInTotal: '', entries: 1, startedAt: Date.now() - 3_600_000, endedAt: Date.now(), durationMin: '60' }}
          onCancel={() => setView('main')}
          onSaved={() => router.push('/history')}
        />
      </>
    );
  }

  // ── Una sesión en curso ──
  if (active) {
    const paused = active.paused_at != null;
    const secs = elapsedSeconds(active, now);
    return (
      <>
        <h1>Sesión en curso</h1>
        <Card>
          <div className={`timer ${paused ? 'paused' : ''}`}>{hms(secs)}</div>
          <p className="muted small" style={{ textAlign: 'center' }}>
            <strong>{activeTitle(active)}</strong>
            {(() => {
              const sub = activeSub(active, d.banks.length > 1 ? bankName(active.bank_id) : undefined);
              return sub ? ` · ${sub}` : '';
            })()}
          </p>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat">
              <div className="k">Invertido</div>
              <div className="v num">{eur(active.buy_in)}</div>
            </div>
            <div className="stat">
              <div className="k">{active.game_type === 'tournament' ? 'Entradas' : 'Recompras'}</div>
              <div className="v num">{active.game_type === 'tournament' ? active.entries : active.entries - 1}</div>
            </div>
          </div>
          <QuickNotes a={active} onChange={update} />
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Empezó a las {new Date(active.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            {new Date(active.started_at).toDateString() !== new Date().toDateString() && ` del ${new Date(active.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}{' · '}
            <button type="button" className="link" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', font: 'inherit' }} onClick={() => setEditStart(editStart == null ? toLocalInput(active.started_at) : null)}>
              Cambiar hora de inicio
            </button>
          </p>
          {editStart != null && (
            <div className="stack">
              <input className="input" type="datetime-local" aria-label="Nueva hora de inicio" style={{ maxWidth: '100%', minWidth: 0 }} max={toLocalInput(Date.now())} value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              <button
                className="btn btn-primary"
                onClick={() => {
                  const ts = new Date(editStart).getTime();
                  if (!Number.isFinite(ts) || ts > Date.now() || (active.paused_at != null && ts > active.paused_at)) return setErr('La hora de inicio no es válida o es posterior a ahora.');
                  setErr(null);
                  update({ ...active, started_at: ts });
                  setEditStart(null);
                }}
              >
                Guardar hora de inicio
              </button>
              {err && <p className="error">{err}</p>}
            </div>
          )}
          <div className="row">
            <button className="btn grow" onClick={() => update(paused ? resumeActive(active) : pauseActive(active))}>
              {paused ? 'Reanudar' : 'Pausar'}
            </button>
            <button className="btn grow" onClick={() => setShowRebuy((v) => !v)}>
              {active.game_type === 'tournament' ? '+ Entrada' : '+ Recompra'}
            </button>
          </div>
          {showRebuy && (
            <div className="row">
              <input
                className="input"
                inputMode="decimal"
                placeholder={String(active.stake ?? active.buy_in)}
                value={rebuy}
                onChange={(e) => setRebuy(e.target.value)}
                aria-label="Importe"
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  const amt = parseNum(rebuy) ?? active.stake ?? null;
                  if (amt == null || amt <= 0) return;
                  update({ ...active, buy_in: active.buy_in + amt, entries: active.entries + 1 });
                  setRebuy('');
                  setShowRebuy(false);
                }}
              >
                Añadir
              </button>
            </div>
          )}
        </Card>
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setCloseAt(active.paused_at ?? Date.now());
            setView('close');
          }}
        >
          Terminar sesión
        </button>
        <button
          className="btn btn-block"
          onClick={() => {
            setSelectedId(null);
            setStartNew(true);
          }}
        >
          Abrir otra sesión a la vez
        </button>
        {actives.length > 1 && (
          <button className="btn btn-ghost btn-block" onClick={() => setSelectedId(null)}>
            Ver todas mis sesiones abiertas ({actives.length})
          </button>
        )}
        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            if (window.confirm('¿Descartar esta sesión sin guardarla?')) {
              discard(active.id);
              setSelectedId(null);
              router.push('/');
            }
          }}
        >
          Descartar
        </button>
      </>
    );
  }

  // ── Varias sesiones abiertas: elegir cuál ──
  if (!startNew && actives.length > 1) {
    return (
      <>
        <h1>Sesiones en curso</h1>
        <Card>
          <div className="list">
            {actives.map((a) => (
              <div className="item" key={a.id}>
                <div style={{ minWidth: 0 }}>
                  <strong>{activeTitle(a)}</strong>
                  <div className="small muted">{activeSub(a, d.banks.length > 1 ? bankName(a.bank_id) : undefined)}</div>
                  <div className="tiny muted">Invertido {eur(a.buy_in)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`num ${a.paused_at ? 'warn' : ''}`} style={{ fontWeight: 700 }}>
                    {hms(elapsedSeconds(a, now))}
                  </div>
                  <button className="btn btn-sm" style={{ marginTop: 4 }} onClick={() => setSelectedId(a.id)}>
                    Abrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <button className="btn btn-primary btn-block" onClick={() => setStartNew(true)}>
          Abrir otra sesión
        </button>
      </>
    );
  }

  // ── Nueva sesión ──
  return (
    <>
      <h1>Nueva sesión</h1>
      {actives.length > 0 && (
        <button className="btn btn-ghost btn-block" onClick={() => setStartNew(false)}>
          Volver a mis sesiones abiertas ({actives.length})
        </button>
      )}
      <Card title="Hora de inicio">
        <StartTimeField value={startAt} onChange={setStartAt} />
      </Card>
      {d.presets.length > 0 && (
        <Card title="Empezar con un toque">
          <div className="chips" aria-label="Presets">
            {d.presets.map((p) => (
              <button key={p.id} className="chip" onClick={() => startFromPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
          <p className="tiny muted">Arranca el temporizador con esa configuración y la hora de inicio de arriba.</p>
          {err && <p className="error">{err}</p>}
        </Card>
      )}
      <Card title={d.presets.length > 0 ? 'O configura una sesión' : undefined}>
        <SetupFields value={setup} onChange={(p) => setSetup((s) => ({ ...s, ...p }))} />
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-block" onClick={start}>
          Empezar sesión
        </button>
        <details>
          <summary className="small muted">Guardar esta configuración como preset</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <input className="input" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Ej.: NL5 online, Torneo del jueves" aria-label="Nombre del preset" />
            <button type="button" className="btn btn-sm" onClick={saveAsPreset}>
              Guardar preset
            </button>
            {presetMsg && <span className={`small ${presetMsg === 'Preset guardado' ? 'pos' : 'error'}`}>{presetMsg}</span>}
          </div>
        </details>
      </Card>
      <button className="btn btn-ghost btn-block" onClick={() => setView('manual')}>
        Registrar una sesión ya jugada
      </button>
    </>
  );
}
