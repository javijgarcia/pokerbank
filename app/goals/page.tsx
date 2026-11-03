'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { bankBalance, goalProgress, lastStakeFor, levelAdvice, type LevelAction } from '@/lib/calc';
import { eur } from '@/lib/format';
import BankFilter from '@/components/BankFilter';
import { stakeLabel } from '@/components/SessionRow';
import { Card, Field, ProgressBar, Segmented, parseNum } from '@/components/ui';
import { DEFAULT_BUYINS, DEFAULT_LADDER, type Bank, type GameType, type GoalKind, type LevelRule } from '@/lib/types';

const ACTION_TEXT: Record<LevelAction, { label: string; cls: string }> = {
  up: { label: 'Puedes subir de nivel', cls: 'pos' },
  down: { label: 'Conviene bajar de nivel', cls: 'neg' },
  stay: { label: 'Mantén el nivel', cls: '' },
  below: { label: 'Bankroll por debajo del nivel mínimo', cls: 'warn' },
};

const GOAL_LABEL: Record<GoalKind, string> = {
  monthly_profit: 'Beneficio del mes (€)',
  monthly_hours: 'Horas del mes',
  bank_target: 'Bankroll objetivo (€)',
};

function LevelCard({ bank, gameType }: { bank: Bank; gameType: GameType }) {
  const d = useData();
  const rule: LevelRule = d.rules.find((r) => r.bank_id === bank.id && r.game_type === gameType) ?? {
    id: '',
    bank_id: bank.id,
    game_type: gameType,
    ...DEFAULT_BUYINS[gameType],
    ladder: DEFAULT_LADDER[gameType],
  };
  const balance = bankBalance(bank, d.movements, d.sessions);
  const a = levelAdvice(balance, rule, lastStakeFor(d.sessions, bank.id, gameType));
  const t = ACTION_TEXT[a.action];
  const pctRule = (100 / rule.buyins).toLocaleString('es-ES', { maximumFractionDigits: 2 });

  return (
    <Card title={`${gameType === 'cash' ? 'Cash' : 'Torneos'}${d.banks.length > 1 ? ' · ' + bank.name : ''}`}>
      <div>
        <div className={`${t.cls}`} style={{ fontWeight: 700, fontSize: 17 }}>
          {t.label}
        </div>
        <div className="small muted">
          {gameType === 'cash' ? `${rule.buyins} buy-ins por nivel` : `ABI = ${pctRule} % del bank (${rule.buyins} ABIs)`} · bajar por debajo de {rule.down_buyins}
        </div>
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat">
          <div className="k">Nivel actual</div>
          <div className="v num">{a.current != null ? stakeLabel(gameType, a.current) : '—'}</div>
        </div>
        <div className="stat">
          <div className="k">Recomendado</div>
          <div className="v num">{a.recommended != null ? stakeLabel(gameType, a.recommended) : '—'}</div>
        </div>
      </div>
      {a.current != null && a.buyinsAtCurrent != null && (
        <p className="small">
          Tienes <strong className="num">{a.buyinsAtCurrent.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</strong> buy-ins de{' '}
          {stakeLabel(gameType, a.current)}.
          {a.downBelow != null && a.action !== 'down' && <span className="muted"> Bajarías por debajo de {eur(a.downBelow)}.</span>}
        </p>
      )}
      {a.next != null && a.action !== 'up' && (
        <>
          <ProgressBar ratio={a.next * rule.buyins > 0 ? balance / (a.next * rule.buyins) : 0} />
          <p className="small muted">
            Te faltan <span className="num">{eur(a.toNext)}</span> para {stakeLabel(gameType, a.next)} (necesitas {eur(a.next * rule.buyins)}).
          </p>
        </>
      )}
      {a.action === 'down' && a.recommended != null && (
        <p className="small">Según tu bankroll actual te corresponde {stakeLabel(gameType, a.recommended)}.</p>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  const d = useData();
  const [kind, setKind] = useState<GoalKind>('monthly_profit');
  const [target, setTarget] = useState('');
  const [bankId, setBankId] = useState<string>('all');
  const [err, setErr] = useState<string | null>(null);

  const progress = useMemo(
    () => d.goals.map((g) => goalProgress(g, d.banks.filter((b) => !b.archived), d.movements, d.sessions)),
    [d.goals, d.banks, d.movements, d.sessions]
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(target);
    if (n == null || n <= 0) return setErr('Indica un objetivo mayor que 0.');
    setErr(await d.saveGoal(kind, n, bankId === 'all' ? null : bankId));
    setTarget('');
  }

  const fmt = (k: GoalKind, v: number) => (k === 'monthly_hours' ? `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h` : eur(v));

  return (
    <>
      <h1>Objetivos y niveles</h1>
      <BankFilter />

      {d.scopeBanks.length === 0 && (
        <Card>
          <p className="muted">Crea una bolsa para ver tus niveles.</p>
        </Card>
      )}

      {d.scopeBanks.map((b) => (
        <div key={b.id} className="stack">
          <LevelCard bank={b} gameType="cash" />
          <LevelCard bank={b} gameType="tournament" />
        </div>
      ))}
      <p className="tiny muted">
        Las reglas (buy-ins por nivel, umbral de bajada y escalera de niveles) se editan en Ajustes. El nivel actual es el último en el que has registrado una sesión; así no oscilas al rozar un umbral.
      </p>

      <Card title="Mis objetivos">
        {progress.length === 0 && <p className="muted small">Aún no tienes objetivos.</p>}
        {progress.map(({ goal, current, ratio }) => (
          <div key={goal.id} className="stack" style={{ gap: 6 }}>
            <div className="row between">
              <strong>{GOAL_LABEL[goal.kind]}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => d.deleteGoal(goal.id)}>
                Quitar
              </button>
            </div>
            <ProgressBar ratio={ratio} />
            <div className="small muted num">
              {fmt(goal.kind, current)} de {fmt(goal.kind, goal.target)} · {Math.round(ratio * 100)} %
              {goal.bank_id ? ` · ${d.banks.find((b) => b.id === goal.bank_id)?.name ?? ''}` : ''}
            </div>
          </div>
        ))}
      </Card>

      <Card title="Nuevo objetivo">
        <form className="stack" onSubmit={add}>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'monthly_profit', label: 'Beneficio' },
              { value: 'monthly_hours', label: 'Horas' },
              { value: 'bank_target', label: 'Bank' },
            ]}
          />
          <Field label={GOAL_LABEL[kind]}>
            <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          {d.banks.filter((b) => !b.archived).length > 1 && (
            <Field label="Bolsa">
              <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                <option value="all">Todas (total)</option>
                {d.banks
                  .filter((b) => !b.archived)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {err && <p className="error">{err}</p>}
          <button className="btn btn-primary">Añadir objetivo</button>
        </form>
      </Card>
    </>
  );
}
