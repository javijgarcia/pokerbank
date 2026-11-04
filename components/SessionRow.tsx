'use client';

import { sessionResult } from '@/lib/calc';
import { dateLabel, eur, hoursLabel, signedEur } from '@/lib/format';
import type { GameType, Session } from '@/lib/types';
import { tone } from './ui';

export function stakeLabel(type: GameType, stake: number | null): string {
  if (stake == null) return '';
  return type === 'cash' ? `NL${stake}` : `ABI ${eur(stake)}`;
}

export default function SessionRow({
  s,
  bankName,
  pending,
  onDelete,
  onPdf,
}: {
  s: Session;
  bankName?: string;
  pending?: boolean;
  onDelete?: (s: Session) => void;
  onPdf?: (s: Session) => void;
}) {
  const r = sessionResult(s);
  const hours = s.duration_seconds / 3600;
  const perHour = hours > 0 ? r / hours : null;
  const title = `${s.game_type === 'cash' ? 'Cash' : 'Torneo'} ${s.venue === 'live' ? 'live' : 'online'}`;
  const meta = [s.game_type === 'tournament' ? s.tournament_name : null, stakeLabel(s.game_type, s.stake), s.place, bankName]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="item">
      <div style={{ minWidth: 0 }}>
        <div>
          <strong>{title}</strong> {pending && <span className="badge warn">Pendiente</span>}
        </div>
        {meta && <div className="small muted">{meta}</div>}
        <div className="tiny muted">
          {dateLabel(s.ended_at)} · {hoursLabel(s.duration_seconds)}
          {perHour != null && ` · ${signedEur(Math.round(perHour * 100) / 100)}/h`}
          {s.mood != null && ` · ánimo ${s.mood}/5`}
          {s.play_quality != null && ` · juego ${s.play_quality}/5`}
          {s.game_type === 'tournament' && s.position != null && ` · puesto ${s.position}${s.players ? '/' + s.players : ''}`}
        </div>
        {s.notes && <div className="tiny muted" style={{ marginTop: 2 }}>{s.notes}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className={`amt num ${tone(r)}`}>{signedEur(r)}</div>
        {(onPdf || onDelete) && (
          <div className="row" style={{ marginTop: 4, justifyContent: 'flex-end', gap: 4 }}>
            {onPdf && (
              <button className="btn btn-ghost btn-sm" onClick={() => onPdf(s)} aria-label="Descargar PDF de la sesión">
                PDF
              </button>
            )}
            {onDelete && (
              <button className="btn btn-ghost btn-sm" onClick={() => onDelete(s)} aria-label="Borrar sesión">
                Borrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
