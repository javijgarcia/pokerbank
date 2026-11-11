'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { eur } from '@/lib/format';
import { ICM_MAX_PLAYERS, PAYOUT_PRESETS, icmTable } from '@/lib/icm';
import { Card, Field, parseNum, tone } from '@/components/ui';

type P = { name: string; stack: string };
const KEY = 'pb.pref.icm';

const DEFAULT_PLAYERS: P[] = [
  { name: 'Yo', stack: '' },
  { name: 'Jugador 2', stack: '' },
  { name: 'Jugador 3', stack: '' },
];

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1).replace('.', ',')} %`;

export default function IcmPage() {
  const [players, setPlayers] = useState<P[]>(DEFAULT_PLAYERS);
  const [prizes, setPrizes] = useState<string[]>(['', '', '']);
  const [pool, setPool] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v.players) && v.players.length >= 2) setPlayers(v.players.slice(0, ICM_MAX_PLAYERS));
        if (Array.isArray(v.prizes) && v.prizes.length >= 1) setPrizes(v.prizes.slice(0, ICM_MAX_PLAYERS));
        if (typeof v.pool === 'string') setPool(v.pool);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ players, prizes, pool }));
    } catch {}
  }, [ready, players, prizes, pool]);

  const prizeNums = prizes.map((p) => parseNum(p) ?? 0);
  const stackNums = players.map((p) => Math.max(0, parseNum(p.stack) ?? 0));
  const prizeTotal = prizeNums.reduce((a, b) => a + b, 0);
  const stackTotal = stackNums.reduce((a, b) => a + b, 0);
  const complete = prizeTotal > 0 && stackNums.filter((s) => s > 0).length >= 2;

  const rows = useMemo(() => (complete ? icmTable(stackNums, prizeNums) : []), [complete, stackNums.join('|'), prizeNums.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const paidSorted = prizeNums.every((v, i) => i === 0 || v <= prizeNums[i - 1]);

  function applyPreset(pcts: number[]) {
    const total = parseNum(pool);
    if (total == null || total <= 0) return;
    const raw = pcts.map((p) => Math.round(((total * p) / 100) * 100) / 100);
    const diff = Math.round((total - raw.reduce((a, b) => a + b, 0)) * 100) / 100;
    raw[0] = Math.round((raw[0] + diff) * 100) / 100;
    setPrizes(raw.map((n) => String(n).replace('.', ',')));
  }

  const setPlayer = (i: number, patch: Partial<P>) => setPlayers((l) => l.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const sorted = [...rows].sort((a, b) => b.stack - a.stack);

  return (
    <>
      <div className="row between">
        <h1>Calculadora de ICM</h1>
        <Link href="/" className="small muted">
          Volver
        </Link>
      </div>
      <p className="muted small">
        Cuánto vale tu stack en euros según los premios que quedan por repartir (modelo Malmuth-Harville). Todo se calcula en tu móvil.
      </p>

      <Card title="Premios">
        <div className="stack">
          <Field label="Bolsa de premios (€) — opcional, para rellenar con un reparto típico">
            <input className="input" inputMode="decimal" placeholder="Ej. 1000" value={pool} onChange={(e) => setPool(e.target.value)} />
          </Field>
          <div className="chips" aria-label="Repartos típicos">
            {PAYOUT_PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" disabled={parseNum(pool) == null} onClick={() => applyPreset(p.pct)}>
                {p.label}
              </button>
            ))}
          </div>
          {prizes.map((v, i) => (
            <div className="row" key={i} style={{ gap: 8 }}>
              <span className="small muted" style={{ width: 34 }}>
                {i + 1}.º
              </span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="€"
                aria-label={`Premio del puesto ${i + 1}`}
                value={v}
                onChange={(e) => setPrizes((l) => l.map((x, k) => (k === i ? e.target.value : x)))}
              />
              {prizes.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Quitar puesto ${i + 1}`} onClick={() => setPrizes((l) => l.filter((_, k) => k !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="row between">
            <button type="button" className="btn btn-sm" disabled={prizes.length >= ICM_MAX_PLAYERS} onClick={() => setPrizes((l) => [...l, ''])}>
              + Puesto pagado
            </button>
            <span className="small muted">Total {eur(prizeTotal)}</span>
          </div>
          {!paidSorted && <p className="error">Los premios deberían bajar de un puesto al siguiente.</p>}
        </div>
      </Card>

      <Card title="Jugadores y stacks">
        <div className="stack">
          {players.map((p, i) => (
            <div className="row" key={i} style={{ gap: 8 }}>
              <input className="input" style={{ flex: '1 1 40%' }} aria-label={`Nombre del jugador ${i + 1}`} value={p.name} onChange={(e) => setPlayer(i, { name: e.target.value })} />
              <input
                className="input"
                style={{ flex: '1 1 40%' }}
                inputMode="numeric"
                placeholder="Fichas"
                aria-label={`Fichas de ${p.name || 'jugador ' + (i + 1)}`}
                value={p.stack}
                onChange={(e) => setPlayer(i, { stack: e.target.value })}
              />
              {players.length > 2 && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Quitar a ${p.name || 'jugador ' + (i + 1)}`} onClick={() => setPlayers((l) => l.filter((_, k) => k !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="row between">
            <button
              type="button"
              className="btn btn-sm"
              disabled={players.length >= ICM_MAX_PLAYERS}
              onClick={() => setPlayers((l) => [...l, { name: `Jugador ${l.length + 1}`, stack: '' }])}
            >
              + Jugador
            </button>
            <span className="small muted">{fmt(stackTotal)} fichas en juego</span>
          </div>
        </div>
      </Card>

      <Card title="Resultado">
        {!complete ? (
          <p className="muted small">Pon los premios y las fichas de al menos dos jugadores para ver el ICM.</p>
        ) : (
          <>
            <div className="lvl lvl-head icm-grid">
              <span>Jugador</span>
              <span>Fichas</span>
              <span>ICM</span>
              <span>Valor</span>
              <span>Vs. fichas</span>
            </div>
            {sorted.map((r) => (
              <div className="lvl icm-grid" key={r.index}>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{players[r.index].name || `Jugador ${r.index + 1}`}</strong>
                <span className="num">{pct(r.chipPct)}</span>
                <span className="num">{pct(r.equityPct)}</span>
                <span className="num">{eur(r.equity)}</span>
                <span className={`num ${tone(Math.round(r.diff * 100))}`}>
                  {r.diff > 0 ? '+' : ''}
                  {eur(r.diff)}
                </span>
              </div>
            ))}
            <p className="tiny muted" style={{ marginTop: 10 }}>
              «Vs. fichas» compara con repartir el premio en proporción a las fichas: en negativo, tus fichas valen menos de lo que parece (el stack grande
              pierde valor por ficha, el corto lo gana). Con más de 10 jugadores o estructuras muy distintas, úsalo solo como guía.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
