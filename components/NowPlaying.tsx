'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { activeFromPreset } from '@/lib/active';
import { clearActive, elapsedSeconds, loadActive, pauseActive, resumeActive, saveActive } from '@/lib/local';
import { eur, hms } from '@/lib/format';
import type { ActiveSession } from '@/lib/types';
import { Card, parseNum } from './ui';
import { stakeLabel } from './SessionRow';

/** "Jugando ahora": sesión en curso con acciones rápidas, o accesos para empezar una. */
export default function NowPlaying() {
  const d = useData();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showRebuy, setShowRebuy] = useState(false);
  const [rebuy, setRebuy] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      setActive(loadActive());
      setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  function update(next: ActiveSession | null) {
    if (next) saveActive(next);
    else clearActive();
    setActive(next);
  }

  if (!active) {
    return (
      <Card title="Jugando ahora">
        <p className="muted small">Aquí aparecerá tu sesión en curso.</p>
        <div className="row">
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
      </Card>
    );
  }

  const paused = active.paused_at != null;
  const bank = d.banks.find((b) => b.id === active.bank_id);
  const title =
    active.game_type === 'tournament' && active.tournament_name
      ? active.tournament_name
      : `${active.game_type === 'cash' ? 'Cash' : 'Torneo'} ${active.venue === 'live' ? 'live' : 'online'}`;
  const sub = [
    active.game_type === 'cash' && active.stake != null ? stakeLabel('cash', active.stake) : null,
    active.place || null,
    d.banks.length > 1 ? bank?.name : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card title="Jugando ahora">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <strong>{title}</strong>
          {sub && <div className="small muted">{sub}</div>}
          <div className="tiny muted">
            Invertido {eur(active.buy_in)} · {active.game_type === 'tournament' ? `${active.entries} entrada(s)` : `${active.entries - 1} recompra(s)`}
          </div>
        </div>
        <div className={`timer-sm num ${paused ? 'warn' : ''}`}>{hms(elapsedSeconds(active, now))}</div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn grow" style={{ padding: '12px 6px' }} onClick={() => update(paused ? resumeActive(active) : pauseActive(active))}>
          {paused ? 'Reanudar' : 'Pausar'}
        </button>
        <button className="btn grow" style={{ padding: '12px 6px' }} onClick={() => setShowRebuy((v) => !v)}>
          {active.game_type === 'tournament' ? '+ Entrada' : '+ Recompra'}
        </button>
        <Link href="/session?close=1" className="btn btn-primary grow" style={{ padding: '12px 6px' }}>
          Terminar
        </Link>
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
      <Link href="/session" className="small muted">
        Abrir sesión completa
      </Link>
    </Card>
  );
}
