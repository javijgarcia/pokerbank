'use client';

import { useData } from '@/lib/data';

/** Selector global de bolsa: Total o una bolsa concreta. */
export default function BankFilter() {
  const { banks, filter, setFilter } = useData();
  const visible = banks.filter((b) => !b.archived || b.id === filter);
  if (visible.length < 2) return null;
  return (
    <div className="chips" role="group" aria-label="Bolsa">
      <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
        Total
      </button>
      {visible.map((b) => (
        <button key={b.id} className="chip" aria-pressed={filter === b.id} onClick={() => setFilter(b.id)}>
          {b.name}
        </button>
      ))}
    </div>
  );
}
