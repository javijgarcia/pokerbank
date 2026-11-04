'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { activeFromPreset, activeTitle } from '@/lib/active';
import { dayStreak } from '@/lib/calc';
import { elapsedSeconds, loadActives, pauseActive, resumeActive, upsertActive } from '@/lib/local';
import { eur, hms } from '@/lib/format';
import type { ActiveSession } from '@/lib/types';
import { Card, parseNum } from './ui';
import { activeSub } from './SessionRow';

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M12 2c.6 3.6 4.5 5.3 4.5 10.2A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.8c0-1.9.9-3.1 1.9-4 .1 1.6.8 2.5 1.6 2.9C10.5 8.5 11 5 12 2z" />
      <path d="M12 22a5.5 5.5 0 0 0 5.5-5.5c0-.9-.3-1.7-.7-2.4-.5 1.6-1.8 2.8-3.3 3-.1-1-.5-1.9-1.5-2.6-1 .8-2 2-2 3.4A3.7 3.7 0 0 0 12 22z" opacity=".55" />
    </svg>
  );
}

/** "Jugando ahora": todas las sesiones abiertas a la vez, con acciones rápidas y un + para abrir otra. */
export default function NowPlaying() {
  const d = useData();
  const [actives, setActives] = useState<ActiveSession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [adding, setAdding] = useState(false);
  const [rebuyId, setRebuyId] = useState<string | null>(null);
  const [rebuy, setRebuy] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      setActives(loadActives());
      setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  function update(a: ActiveSession) {
    setActives(upsertActive(a));
  }

  const streak = dayStreak(d.sessions, actives.map((a) => a.started_at));
  const showStart = actives.length === 0 || adding;

  return (
    <Card
      title="Jugando ahora"
      action={
        <div className="row" style={{ gap: 8 }}>
          {streak > 0 && (
            <span className="badge flame" title={`${streak} día(s) seguidos jugando`}>
              <Flame /> {streak}
            </span>
          )}
          <button
            className="icon-btn plus"
            aria-label={adding ? 'Cerrar' : 'Abrir otra sesión'}
            aria-expanded={adding}
            onClick={() => {
              setAdding((v) => !v);
              setErr(null);
            }}
          >
            {adding ? '×' : '+'}
          </button>
        </div>
      }
    >
      {actives.length === 0 && !adding && <p className="muted small">Aquí aparecerán tus sesiones en curso. Puedes tener varias a la vez.</p>}

      {showStart && (
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <Link href="/session?type=cash" className="btn grow">
              Cash
            </Link>
            <Link href="/session?type=tournament" className="btn grow">
              Torneo
            </Link>
          </div>
          {d.presets.length > 0 && (
            <>
              <div className="chips" aria-label="Presets">
                {d.presets.map((p) => (
                  <button
                    key={p.id}
                    className="chip"
                    onClick={() => {
                      const a = activeFromPreset(p);
                      if (!a) return setErr('Este preset no tiene buy-in. Bórralo y vuelve a crearlo en Ajustes.');
                      setErr(null);
                      update(a);
                      setAdding(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="tiny muted">Toca un preset para empezar al instante.</p>
            </>
          )}
          {err && <p className="error">{err}</p>}
        </div>
      )}

      {actives.map((a) => {
        const paused = a.paused_at != null;
        const bank = d.banks.find((b) => b.id === a.bank_id)?.name;
        const sub = activeSub(a, d.banks.length > 1 ? bank : undefined);
        return (
          <div className="live" key={a.id}>
            <div className="row between">
              <div style={{ minWidth: 0 }}>
                <strong>{activeTitle(a)}</strong>
                {sub && <div className="small muted">{sub}</div>}
                <div className="tiny muted">
                  Invertido {eur(a.buy_in)} · {a.game_type === 'tournament' ? `${a.entries} entrada(s)` : `${a.entries - 1} recompra(s)`}
                </div>
              </div>
              <div className={`timer-sm num ${paused ? 'warn' : ''}`}>{hms(elapsedSeconds(a, now))}</div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn grow" style={{ padding: '12px 6px', fontSize: 14 }} onClick={() => update(paused ? resumeActive(a) : pauseActive(a))}>
                {paused ? 'Reanudar' : 'Pausar'}
              </button>
              <button
                className="btn grow"
                style={{ padding: '12px 6px', fontSize: 14 }}
                onClick={() => {
                  setRebuyId(rebuyId === a.id ? null : a.id);
                  setRebuy('');
                }}
              >
                {a.game_type === 'tournament' ? '+ Entrada' : '+ Recompra'}
              </button>
              <Link href={`/session?close=${a.id}`} className="btn btn-primary grow" style={{ padding: '12px 6px', fontSize: 14 }}>
                Terminar
              </Link>
            </div>

            {rebuyId === a.id && (
              <div className="row">
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder={String(a.stake ?? a.buy_in)}
                  value={rebuy}
                  onChange={(e) => setRebuy(e.target.value)}
                  aria-label="Importe"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const amt = parseNum(rebuy) ?? a.stake ?? null;
                    if (amt == null || amt <= 0) return;
                    update({ ...a, buy_in: a.buy_in + amt, entries: a.entries + 1 });
                    setRebuyId(null);
                    setRebuy('');
                  }}
                >
                  Añadir
                </button>
              </div>
            )}
            <Link href={`/session?id=${a.id}`} className="small muted">
              Abrir sesión completa
            </Link>
          </div>
        );
      })}
    </Card>
  );
}
