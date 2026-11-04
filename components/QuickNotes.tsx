'use client';

import { useState } from 'react';
import { bountySum } from '@/lib/active';
import { eur } from '@/lib/format';
import type { ActiveSession } from '@/lib/types';
import { parseNum } from './ui';

/**
 * Notas rápidas de un torneo en curso: apuntar un bounty por cada eliminación,
 * y marcar si has sido eliminado o has ganado el torneo. Solo se muestra en torneos.
 */
export default function QuickNotes({ a, onChange }: { a: ActiveSession; onChange: (a: ActiveSession) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);

  if (a.game_type !== 'tournament') return null;

  const bounties = a.bounties ?? [];
  const total = bountySum(a);

  function add() {
    const n = parseNum(amount);
    if (n == null || n <= 0) return setErr('Indica el importe del bounty.');
    setErr(null);
    onChange({ ...a, bounties: [...bounties, Math.round(n * 100) / 100] });
    setAmount('');
    setOpen(false);
  }

  const setOutcome = (o: 'bust' | 'win') => onChange({ ...a, outcome: a.outcome === o ? null : o });

  return (
    <div className="stack" aria-label="Notas rápidas">
      <div className="chips">
        {a.has_bounty && (
          <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            + Bounty
          </button>
        )}
        <button type="button" className="chip" aria-pressed={a.outcome === 'bust'} onClick={() => setOutcome('bust')}>
          Busteado
        </button>
        <button type="button" className="chip" aria-pressed={a.outcome === 'win'} onClick={() => setOutcome('win')}>
          Ganado
        </button>
      </div>

      {a.has_bounty && open && (
        <div className="row">
          <input
            className="input"
            inputMode="decimal"
            autoFocus
            placeholder="Bounty ganado (€)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            aria-label="Importe del bounty"
          />
          <button type="button" className="btn btn-primary" onClick={add}>
            Añadir
          </button>
        </div>
      )}
      {err && <p className="error">{err}</p>}

      {a.has_bounty && bounties.length > 0 && (
        <div className="row between small">
          <span>
            <strong className="pos num">{eur(total)}</strong> en bounties · {bounties.length} eliminación(es)
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...a, bounties: bounties.slice(0, -1) })}>
            Deshacer ({eur(bounties[bounties.length - 1])})
          </button>
        </div>
      )}
    </div>
  );
}
