'use client';

import { hoursLabel } from '@/lib/format';
import type { Profile, SharedSession } from '@/lib/social';
import { tone } from './ui';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

export const roiLabel = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

export function postTitle(p: Pick<SharedSession, 'game_type' | 'venue' | 'tournament_name'>): string {
  if (p.game_type === 'tournament' && p.tournament_name) return p.tournament_name;
  return `${p.game_type === 'cash' ? 'Cash' : 'Torneo'} ${p.venue === 'live' ? 'live' : 'online'}`;
}

/** Una sesión publicada en el feed. */
export default function PostCard({ post, author, mine, onDelete }: { post: SharedSession; author?: Profile; mine: boolean; onDelete?: (p: SharedSession) => void }) {
  const name = author?.display_name ?? 'Jugador';
  const when = new Date(post.ended_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const bits = [
    post.game_type === 'tournament' && post.position ? `Puesto ${post.position}${post.players ? ` de ${post.players}` : ''}` : null,
    post.game_type === 'tournament' && post.itm != null ? (post.itm ? 'ITM' : 'Sin premio') : null,
    hoursLabel(post.duration_seconds),
    post.mood ? MOODS[post.mood - 1] : null,
  ].filter(Boolean);

  return (
    <article className="card stack" aria-label={`Sesión de ${name}`}>
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <strong>{mine ? 'Tú' : name}</strong>
          {author && !mine && <span className="small muted"> @{author.username}</span>}
          <div className="tiny muted">{when}</div>
        </div>
        {post.roi_pct != null && (
          <div className={`num ${tone(post.roi_pct)}`} style={{ fontSize: 22, fontWeight: 700 }} aria-label="ROI de la sesión">
            {roiLabel(post.roi_pct)}
          </div>
        )}
      </div>
      <div>
        <div>{postTitle(post)}</div>
        <div className="small muted">{bits.join(' · ')}</div>
      </div>
      {post.caption && <p className="small" style={{ margin: 0 }}>{post.caption}</p>}
      {mine && onDelete && (
        <button className="btn btn-ghost btn-sm" onClick={() => onDelete(post)}>
          Quitar del feed
        </button>
      )}
    </article>
  );
}
