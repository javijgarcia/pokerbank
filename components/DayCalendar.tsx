'use client';

import { useMemo, useState } from 'react';
import { monthGrid } from '@/lib/daily';
import { eur, hoursLabel, signedEur } from '@/lib/format';
import type { Session } from '@/lib/types';
import { Card, tone } from './ui';
import SessionRow from './SessionRow';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const monthName = (y: number, m: number) => {
  const s = new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Importe corto para la casilla del día: sin decimales salvo importes pequeños. */
const short = (n: number) => {
  const a = Math.abs(n);
  const t = a >= 100 ? Math.round(a).toString() : a % 1 === 0 ? a.toString() : a.toFixed(1).replace('.', ',');
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${t}`;
};

function Mini({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="cs">
      <div className="k">{label}</div>
      <div className={`v num ${className}`}>{value}</div>
    </div>
  );
}

/** Calendario de resultados: ganancia o pérdida de cada día del mes + resumen de días. */
export default function DayCalendar({ sessions, bankName }: { sessions: Session[]; bankName: (id: string) => string | undefined }) {
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState<number | null>(null);

  const g = useMemo(() => monthGrid(sessions, ym.y, ym.m), [sessions, ym]);
  const s = g.summary;
  const isNow = ym.y === today.getFullYear() && ym.m === today.getMonth();

  const daySessions = useMemo(() => {
    if (sel == null) return [];
    return sessions
      .filter((x) => {
        const e = new Date(x.ended_at);
        return e.getFullYear() === ym.y && e.getMonth() === ym.m && e.getDate() === sel;
      })
      .sort((a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime());
  }, [sessions, ym, sel]);

  function move(delta: number) {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setSel(null);
  }

  return (
    <Card title="Calendario de resultados">
      <div className="row between">
        <button className="btn btn-ghost btn-sm" onClick={() => move(-1)} aria-label="Mes anterior">
          ‹
        </button>
        <strong>{monthName(ym.y, ym.m)}</strong>
        <button className="btn btn-ghost btn-sm" onClick={() => move(1)} aria-label="Mes siguiente" disabled={isNow}>
          ›
        </button>
      </div>

      <div className="daycal" role="grid" aria-label={monthName(ym.y, ym.m)}>
        {WEEK.map((w) => (
          <span className="dc-h" key={w} aria-hidden>
            {w}
          </span>
        ))}
        {Array.from({ length: g.lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {g.cells.map((c) => {
          const isToday = isNow && c.day === today.getDate();
          const future = isNow && c.day > today.getDate();
          const cls = c.profit == null ? '' : c.profit > 0 ? 'win' : c.profit < 0 ? 'loss' : 'even';
          return (
            <button
              key={c.day}
              type="button"
              className={`dc ${cls} ${isToday ? 'today' : ''} ${sel === c.day ? 'sel' : ''} ${future ? 'future' : ''}`}
              disabled={c.profit == null}
              aria-pressed={sel === c.day}
              aria-label={c.profit == null ? `Día ${c.day}, sin jugar` : `Día ${c.day}, ${signedEur(c.profit)}`}
              onClick={() => setSel(sel === c.day ? null : c.day)}
            >
              <i>{c.day}</i>
              <b className="num">{c.profit == null ? '' : c.profit === 0 ? '0' : short(c.profit)}</b>
            </button>
          );
        })}
      </div>

      {s.playedDays === 0 ? (
        <p className="muted small">No hay sesiones este mes con estos filtros.</p>
      ) : (
        <>
          <div className="cal-stats">
            <Mini label="Resultado del mes" value={signedEur(s.profit)} className={tone(s.profit)} />
            <Mini label="Días jugados" value={String(s.playedDays)} />
            <Mini label="Días ganados" value={String(s.winDays)} className={s.winDays ? 'pos' : ''} />
            <Mini label="Días perdidos" value={String(s.lossDays)} className={s.lossDays ? 'neg' : ''} />
            <Mini label="Días sin jugar" value={String(s.restDays)} />
            <Mini label="% días ganados" value={s.winDayRate == null ? '—' : `${Math.round(s.winDayRate)} %`} />
            <Mini label="Media por día" value={s.avgPerPlayedDay == null ? '—' : signedEur(s.avgPerPlayedDay)} className={tone(s.avgPerPlayedDay ?? 0)} />
            <Mini label="Sesiones" value={`${s.sessions} · ${hoursLabel(s.seconds)}`} />
            <Mini label="Mejor día" value={s.bestDay ? `${signedEur(s.bestDay.profit)} (día ${s.bestDay.day})` : '—'} className={s.bestDay ? 'pos' : ''} />
            <Mini label="Peor día" value={s.worstDay ? `${signedEur(s.worstDay.profit)} (día ${s.worstDay.day})` : '—'} className={s.worstDay ? 'neg' : ''} />
            <Mini label="Racha de días ganados" value={String(s.bestWinDayStreak)} />
            {s.evenDays > 0 && <Mini label="Días en tablas" value={String(s.evenDays)} />}
          </div>
          <p className="tiny muted">
            Cada sesión cuenta en el día en que termina. Toca un día para ver sus sesiones. Respeta el filtro de bolsa y de tipo de juego.
          </p>
        </>
      )}

      {sel != null && daySessions.length > 0 && (
        <div className="list" aria-live="polite">
          <div className="small muted">
            {sel} de {monthName(ym.y, ym.m).toLowerCase()} · {eur(daySessions.reduce((a, x) => a + x.cash_out - x.buy_in, 0))}
          </div>
          {daySessions.map((x) => (
            <SessionRow key={x.id} s={x} bankName={bankName(x.bank_id)} />
          ))}
        </div>
      )}
    </Card>
  );
}
