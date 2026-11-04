'use client';

import { useMemo } from 'react';
import { computeStats } from '@/lib/calc';
import { eur, pct, signedEur } from '@/lib/format';
import type { Session } from '@/lib/types';
import { Card, Stat, tone } from './ui';

/** Estadísticas solo de torneos. No se muestra si no hay ninguno en la lista. */
export default function TournamentStats({ sessions, title = 'Torneos' }: { sessions: Session[]; title?: string }) {
  const st = useMemo(() => computeStats(sessions.filter((s) => s.game_type === 'tournament')), [sessions]);
  if (st.count === 0 || st.abi == null) return null;
  return (
    <Card title={title}>
      <div className="stats">
        <Stat label="Torneos" value={String(st.count)} />
        <Stat label="ABI medio" value={eur(st.abi)} />
        <Stat label="ITM" value={st.itm == null ? '—' : pct(st.itm)} />
        <Stat label="ROI" value={pct(st.roi, 1)} className={tone(st.roi)} />
        <Stat label="Resultado" value={signedEur(st.profit)} className={tone(st.profit)} />
        <Stat label="Mejor premio" value={eur(st.bestCash)} />
        {st.bountyCount > 0 && <Stat label="Bounties ganados" value={eur(st.bountyTotal)} />}
        {st.bountyCount > 0 && <Stat label="Eliminaciones" value={String(st.bountyCount)} />}
      </div>
      <p className="tiny muted">ABI medio = buy-in total invertido entre el número de entradas (re-entries incluidos). ITM = torneos con premio mayor que 0, sin contar bounties.</p>
    </Card>
  );
}
