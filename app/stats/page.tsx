'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { balanceSeries, bankBalance, byLevel, computeStats, computeStreaks, moodBreakdown, profitSeries } from '@/lib/calc';
import { eur, hoursLabel, pct, signedEur } from '@/lib/format';
import { inRange, periodLabel, periodRange, type PeriodKind } from '@/lib/period';
import type { GameType } from '@/lib/types';
import BankChart from '@/components/BankChart';
import BankFilter from '@/components/BankFilter';
import { Card, Segmented, tone } from '@/components/ui';
import { IconCash, IconLayers, IconTrophy } from '@/components/icons';

function Box({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="stat2">
      <div className="k">{label}</div>
      <div className={`v num ${className}`}>{value}</div>
    </div>
  );
}

export default function StatsPage() {
  const d = useData();
  const [type, setType] = useState<'all' | GameType>('all');
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const [chart, setChart] = useState<'profit' | 'bank'>('profit');

  const range = useMemo(() => periodRange(kind, offset), [kind, offset]);
  const banks = d.scopeBanks;

  const typeSessions = useMemo(() => {
    const ids = new Set(banks.map((b) => b.id));
    return d.sessions.filter((s) => ids.has(s.bank_id) && (type === 'all' || s.game_type === type));
  }, [banks, d.sessions, type]);

  const periodSessions = useMemo(
    () => typeSessions.filter((s) => inRange(new Date(s.ended_at).getTime(), range)),
    [typeSessions, range]
  );

  const stats = useMemo(() => computeStats(periodSessions), [periodSessions]);
  const moods = useMemo(() => moodBreakdown(periodSessions), [periodSessions]);
  const tLevels = useMemo(() => byLevel(periodSessions, 'tournament'), [periodSessions]);
  const cLevels = useMemo(() => byLevel(periodSessions, 'cash'), [periodSessions]);
  const streaks = useMemo(() => computeStreaks(typeSessions), [typeSessions]);

  // El gráfico de bankroll incluye ingresos/retiradas y todos los tipos de juego: solo tiene sentido en "Todo".
  const mode = type === 'all' ? chart : 'profit';
  const series = useMemo(
    () => (mode === 'bank' ? balanceSeries(banks, d.movements, d.sessions, null) : profitSeries(typeSessions, range)),
    [mode, banks, d.movements, d.sessions, typeSessions, range]
  );

  // Saldo actual de las bolsas visibles (con ingresos y retiradas): es lo que muestra el modo Bankroll.
  const bankTotal = useMemo(() => banks.reduce((a, b) => a + bankBalance(b, d.movements, d.sessions), 0), [banks, d.movements, d.sessions]);

  const maxAbs = Math.max(1, ...moods.map((m) => Math.abs(m.perHour)));
  const isTourney = type === 'tournament';

  function changeKind(k: PeriodKind) {
    setKind(k);
    setOffset(0);
  }

  return (
    <>
      <h1>Estadísticas</h1>
      <BankFilter />
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'all', label: 'Todo', icon: <IconLayers /> },
          { value: 'cash', label: 'Cash', icon: <IconCash /> },
          { value: 'tournament', label: 'Torneos', icon: <IconTrophy /> },
        ]}
      />

      <section className="card hero">
        <div className="muted small">{mode === 'bank' ? 'Bankroll · total' : `Beneficio · ${periodLabel(kind, range)}`}</div>
        {mode === 'bank' ? (
          <div className="big num" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {eur(bankTotal)}
          </div>
        ) : (
          <div className={`big num ${tone(stats.profit)}`} style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {signedEur(stats.profit)}
          </div>
        )}
        {type === 'all' && (
          <Segmented
            value={chart}
            onChange={setChart}
            options={[
              { value: 'profit', label: 'Beneficio' },
              { value: 'bank', label: 'Bankroll' },
            ]}
          />
        )}
        <BankChart series={series} />
        <p className="tiny muted">
          {mode === 'bank'
            ? 'Bankroll total desde el principio, con ingresos y retiradas. El filtro de periodo no lo afecta; sí a las estadísticas de abajo.'
            : 'Beneficio acumulado de las sesiones del periodo, empezando en 0.'}
        </p>
      </section>

      {stats.count === 0 ? (
        <Card>
          <p className="muted small">No hay sesiones en este periodo con estos filtros.</p>
        </Card>
      ) : isTourney ? (
        <div className="stats2">
          <Box label="Torneos" value={String(stats.count)} />
          <Box label="Entradas totales" value={String(stats.entries)} />
          <Box label="Horas jugadas" value={hoursLabel(stats.seconds)} />
          <Box label="ITM" value={stats.itm == null ? '—' : pct(stats.itm, 1)} />
          <Box label="ROI total" value={pct(stats.roi, 1)} className={tone(stats.roi)} />
          <Box label="ROI medio por torneo" value={stats.avgRoiTournament == null ? '—' : pct(stats.avgRoiTournament, 1)} className={tone(stats.avgRoiTournament ?? 0)} />
          <Box label="Beneficio medio por entrada" value={signedEur(stats.avgProfitPerEntry)} className={tone(stats.avgProfitPerEntry)} />
          <Box label="ABI medio" value={stats.abi == null ? '—' : eur(stats.abi)} />
          <Box label="Mejor premio" value={eur(stats.bestCash)} />
          {stats.bountyCount > 0 && <Box label="Bounties ganados" value={eur(stats.bountyTotal)} />}
          {stats.bountyCount > 0 && <Box label="Eliminaciones" value={String(stats.bountyCount)} />}
          <Box label="€/hora" value={signedEur(stats.perHour)} className={tone(stats.perHour)} />
        </div>
      ) : (
        <div className="stats2">
          <Box label="Sesiones" value={String(stats.count)} />
          <Box label="Horas jugadas" value={hoursLabel(stats.seconds)} />
          <Box label="€/hora" value={signedEur(stats.perHour)} className={tone(stats.perHour)} />
          <Box label="ROI" value={pct(stats.roi, 1)} className={tone(stats.roi)} />
          <Box label="Resultado medio por sesión" value={signedEur(stats.avgProfit)} className={tone(stats.avgProfit)} />
          <Box label="Sesiones ganadas" value={pct(stats.winRate)} />
          <Box label="Invertido" value={eur(stats.invested)} />
          <Box label="Estado mental medio" value={stats.avgMood == null ? '—' : `${stats.avgMood.toFixed(1)} / 5`} />
        </div>
      )}

      {type !== 'cash' && tLevels.length > 0 && (
        <Card title="Torneos por buy-in">
          <div className="lvl lvl-head" aria-hidden>
            <span>Buy-in</span>
            <span>Torneos</span>
            <span>ROI</span>
            <span>ITM</span>
            <span>Beneficio</span>
          </div>
          {tLevels.map((r) => (
            <div className="lvl" key={r.level}>
              <strong className="num">{eur(r.level)}</strong>
              <span className="num">{r.count}</span>
              <span className={`num ${tone(r.roi)}`}>{pct(r.roi, 0)}</span>
              <span className="num">{r.itm == null ? '—' : pct(r.itm, 0)}</span>
              <span className={`num ${tone(r.profit)}`}>{signedEur(r.profit)}</span>
            </div>
          ))}
          <p className="tiny muted">Agrupado por el buy-in inicial de cada torneo. Con pocos torneos en un nivel, el ROI es muy ruidoso.</p>
        </Card>
      )}

      {type !== 'tournament' && cLevels.length > 0 && (
        <Card title="Cash por nivel">
          <div className="lvl lvl-head" aria-hidden>
            <span>Nivel</span>
            <span>Sesiones</span>
            <span>€/hora</span>
            <span>ROI</span>
            <span>Beneficio</span>
          </div>
          {cLevels.map((r) => (
            <div className="lvl" key={r.level}>
              <strong className="num">NL{r.level}</strong>
              <span className="num">{r.count}</span>
              <span className={`num ${tone(r.perHour)}`}>{signedEur(r.perHour)}</span>
              <span className={`num ${tone(r.roi)}`}>{pct(r.roi, 0)}</span>
              <span className={`num ${tone(r.profit)}`}>{signedEur(r.profit)}</span>
            </div>
          ))}
        </Card>
      )}

      {streaks.current.type && (
        <Card title="Rachas">
          <p className="small">
            Racha actual:{' '}
            <strong className={streaks.current.type === 'win' ? 'pos' : 'neg'}>
              {streaks.current.count} {streaks.current.type === 'win' ? 'ganada' : 'perdida'}
              {streaks.current.count > 1 ? 's' : ''}
            </strong>
            <span className="muted">
              {' '}
              · mejor {streaks.bestWin} ganadas · peor {streaks.worstLoss} perdidas (histórico)
            </span>
          </p>
        </Card>
      )}

      {moods.length > 0 && (
        <Card title="€/hora según tu estado mental">
          <div className="stack">
            {moods.map((m) => (
              <div key={m.mood} className="row small">
                <span style={{ width: 54 }}>Ánimo {m.mood}</span>
                <div className="bar grow">
                  <i style={{ width: `${(Math.abs(m.perHour) / maxAbs) * 100}%`, background: m.perHour >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
                </div>
                <span className={`num ${tone(m.perHour)}`} style={{ width: 78, textAlign: 'right' }}>
                  {signedEur(m.perHour)}/h
                </span>
                <span className="muted tiny" style={{ width: 28, textAlign: 'right' }}>
                  n={m.count}
                </span>
              </div>
            ))}
          </div>
          <p className="tiny muted">Con pocas sesiones por nivel, estos números son ruido; úsalos como tendencia.</p>
        </Card>
      )}

      <div style={{ height: 64 }} aria-hidden />

      <div className="filterbar">
        <div className="inner">
          <button onClick={() => setOffset((o) => o - 1)} disabled={kind === 'all'} aria-label="Periodo anterior">
            ‹
          </button>
          <Segmented
            value={kind}
            onChange={changeKind}
            options={[
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Año' },
              { value: 'all', label: 'General' },
            ]}
          />
          <button onClick={() => setOffset((o) => o + 1)} disabled={kind === 'all' || offset >= 0} aria-label="Periodo siguiente">
            ›
          </button>
        </div>
      </div>
    </>
  );
}
