'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { bankBalance, sessionResult } from '@/lib/calc';
import { eur, monthKey, signedEur } from '@/lib/format';
import { loadPref, savePref } from '@/lib/local';
import { tone } from './ui';

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Una tarjeta por bolsa (más el total si hay varias). Tocar una tarjeta filtra el resto de la app por esa bolsa. */
export default function BalanceCards() {
  const d = useData();
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(loadPref<boolean>('hideBalance', false)), []);

  const banks = d.banks.filter((b) => !b.archived);
  const thisMonth = monthKey(new Date());

  const cards = useMemo(() => {
    const monthProfit = (ids: Set<string>) =>
      d.sessions.filter((s) => ids.has(s.bank_id) && monthKey(s.ended_at) === thisMonth).reduce((a, s) => a + sessionResult(s), 0);
    const total = banks.reduce((a, b) => a + bankBalance(b, d.movements, d.sessions), 0);
    const list = [
      ...(banks.length > 1
        ? [{ id: 'all', name: 'Total', balance: total, month: monthProfit(new Set(banks.map((b) => b.id))) }]
        : []),
      ...banks.map((b) => ({
        id: b.id,
        name: b.name,
        balance: bankBalance(b, d.movements, d.sessions),
        month: monthProfit(new Set([b.id])),
      })),
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.banks, d.movements, d.sessions, thisMonth]);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    savePref('hideBalance', next);
  }

  const selected = banks.length > 1 ? d.filter : (banks[0]?.id ?? 'all');

  return (
    <div className="cards" role="group" aria-label="Saldo por bolsa">
      {cards.map((c) => (
        <div
          key={c.id}
          className="bcard"
          data-selected={selected === c.id}
          role={banks.length > 1 ? 'button' : undefined}
          tabIndex={banks.length > 1 ? 0 : undefined}
          aria-pressed={banks.length > 1 ? selected === c.id : undefined}
          onClick={() => banks.length > 1 && d.setFilter(c.id)}
          onKeyDown={(e) => {
            if (banks.length > 1 && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              d.setFilter(c.id);
            }
          }}
        >
          <div className="row between">
            <span className="muted small">Saldo · {c.name}</span>
            <button
              className="icon-btn"
              aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
            >
              <Eye off={hidden} />
            </button>
          </div>
          <div className="big num">{hidden ? '••••••' : eur(c.balance)}</div>
          <div className="row between small">
            <span className="badge">EUR</span>
            <span className={`num ${hidden ? 'muted' : tone(c.month)}`}>
              {hidden ? '••••' : signedEur(Math.round(c.month * 100) / 100)} <span className="muted">este mes</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
