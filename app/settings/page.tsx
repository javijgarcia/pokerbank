'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { loadPref, savePref } from '@/lib/local';
import { applyTheme, type ThemePref } from '@/lib/theme';
import { bankBalance } from '@/lib/calc';
import { dateLabel, eur, signedEur } from '@/lib/format';
import { Card, Field, Segmented, parseNum, tone } from '@/components/ui';
import AccountCards from '@/components/AccountCards';
import { DEFAULT_BUYINS, DEFAULT_LADDER, type Bank, type GameType, type LevelRule } from '@/lib/types';

function RuleEditor({ bank, gameType }: { bank: Bank; gameType: GameType }) {
  const d = useData();
  const existing = d.rules.find((r) => r.bank_id === bank.id && r.game_type === gameType);
  const initial = existing ?? { ...DEFAULT_BUYINS[gameType], ladder: DEFAULT_LADDER[gameType] };
  const [buyins, setBuyins] = useState(String(initial.buyins));
  const [down, setDown] = useState(String(initial.down_buyins));
  const [ladder, setLadder] = useState(initial.ladder.join(', '));
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const b = parseNum(buyins);
    const dn = parseNum(down);
    const lad = ladder
      .split(',')
      .map((x) => parseNum(x))
      .filter((x): x is number => x != null && x > 0);
    if (b == null || b <= 0 || dn == null || dn <= 0) return setMsg('Buy-ins debe ser mayor que 0.');
    if (dn > b) return setMsg('El umbral de bajada no puede ser mayor que los buy-ins para subir.');
    if (lad.length === 0) return setMsg('Indica al menos un nivel.');
    const rule: Omit<LevelRule, 'id'> & { id?: string } = {
      id: existing?.id,
      bank_id: bank.id,
      game_type: gameType,
      buyins: b,
      down_buyins: dn,
      ladder: [...new Set(lad)].sort((x, y) => x - y),
    };
    const err = await d.saveRule(rule);
    setMsg(err ?? 'Guardado');
  }

  return (
    <div className="stack">
      <strong>{gameType === 'cash' ? 'Cash' : 'Torneos'}</strong>
      <div className="row">
        <div className="grow">
          <Field label={gameType === 'cash' ? 'Buy-ins por nivel' : 'ABIs por nivel (100 = 1 %)'}>
            <input className="input" inputMode="decimal" value={buyins} onChange={(e) => setBuyins(e.target.value)} />
          </Field>
        </div>
        <div className="grow">
          <Field label="Bajar por debajo de">
            <input className="input" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label={gameType === 'cash' ? 'Niveles (NL, separados por comas)' : 'ABIs (€, separados por comas)'}>
        <input className="input" value={ladder} onChange={(e) => setLadder(e.target.value)} />
      </Field>
      <div className="row">
        <button className="btn btn-sm" onClick={save}>
          Guardar reglas
        </button>
        {msg && <span className={`small ${msg === 'Guardado' ? 'pos' : 'error'}`}>{msg}</span>}
      </div>
    </div>
  );
}

function MovementForm() {
  const d = useData();
  const banks = d.banks.filter((b) => !b.archived);
  const [bankId, setBankId] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(amount);
    const id = bankId || banks[0]?.id;
    if (!id) return setErr('Crea una bolsa primero.');
    if (n == null || n <= 0) return setErr('Indica un importe mayor que 0.');
    const e2 = await d.addMovement(id, kind === 'in' ? n : -n, note.trim());
    setErr(e2);
    if (!e2) {
      setAmount('');
      setNote('');
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'in', label: 'Ingreso' },
          { value: 'out', label: 'Retirada' },
        ]}
      />
      {banks.length > 1 && (
        <Field label="Bolsa">
          <select className="input" value={bankId || banks[0].id} onChange={(e) => setBankId(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Importe (€)">
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Nota (opcional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary">Registrar movimiento</button>
    </form>
  );
}

function ThemeCard() {
  const [theme, setTheme] = useState<ThemePref>('dark');
  useEffect(() => setTheme(loadPref<ThemePref>('theme', 'dark')), []);

  function change(t: ThemePref) {
    setTheme(t);
    savePref('theme', t);
    applyTheme(t);
  }

  return (
    <Card title="Apariencia">
      <Segmented
        value={theme}
        onChange={change}
        options={[
          { value: 'dark', label: 'Oscuro' },
          { value: 'light', label: 'Claro' },
          { value: 'auto', label: 'Auto' },
        ]}
      />
      <p className="tiny muted">Auto sigue el tema de tu móvil. Se guarda en este dispositivo.</p>
    </Card>
  );
}

export default function SettingsPage() {
  const d = useData();
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function addBank(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('Pon un nombre a la bolsa.');
    const e2 = await d.addBank(name.trim(), parseNum(initial) ?? 0);
    setErr(e2);
    if (!e2) {
      setName('');
      setInitial('');
    }
  }

  const movements = [...d.movements].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 8);
  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name ?? '';

  return (
    <>
      <h1>Ajustes</h1>

      <Card title="Bolsas">
        <div className="list">
          {d.banks.map((b) => (
            <div className="item" key={b.id}>
              <div>
                <strong>{b.name}</strong> {b.archived && <span className="badge">Archivada</span>}
                <div className="small muted num">{eur(bankBalance(b, d.movements, d.sessions))}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => d.archiveBank(b.id, !b.archived)}>
                {b.archived ? 'Restaurar' : 'Archivar'}
              </button>
            </div>
          ))}
          {d.banks.length === 0 && <p className="muted small">Todavía no tienes bolsas.</p>}
        </div>
        <hr />
        <form className="stack" onSubmit={addBank}>
          <Field label="Nueva bolsa">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Online, Live, Torneos…" />
          </Field>
          <Field label="Saldo inicial (€)">
            <input className="input" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" />
          </Field>
          {err && <p className="error">{err}</p>}
          <button className="btn">Crear bolsa</button>
        </form>
        <p className="tiny muted">
          El total es la suma de las bolsas no archivadas. Cada sesión pertenece a una bolsa; además puedes filtrar por tipo y modalidad en el historial.
        </p>
      </Card>

      {d.banks.length > 0 && (
        <Card title="Ingresos y retiradas">
          <MovementForm />
          {movements.length > 0 && (
            <div className="list">
              {movements.map((m) => (
                <div className="item" key={m.id}>
                  <div>
                    <div className="small">{m.note || (m.amount >= 0 ? 'Ingreso' : 'Retirada')}</div>
                    <div className="tiny muted">
                      {dateLabel(m.occurred_at)}
                      {d.banks.length > 1 && ` · ${bankName(m.bank_id)}`}
                    </div>
                  </div>
                  <div>
                    <div className={`amt num ${tone(m.amount)}`}>{signedEur(m.amount)}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => window.confirm('¿Borrar este movimiento?') && d.deleteMovement(m.id)}>
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {d.banks
        .filter((b) => !b.archived)
        .map((b) => (
          <Card key={`${b.id}-${d.rules.length}`} title={`Reglas de nivel${d.banks.length > 1 ? ' · ' + b.name : ''}`}>
            <RuleEditor bank={b} gameType="cash" />
            <hr />
            <RuleEditor bank={b} gameType="tournament" />
          </Card>
        ))}

      <Card title="Presets de sesión">
        {d.presets.length === 0 ? (
          <p className="muted small">
            Aún no tienes presets. Crea uno desde Sesión &gt; Nueva sesión, con «Guardar esta configuración como preset».
          </p>
        ) : (
          <div className="list">
            {d.presets.map((p) => (
              <div className="item" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <div className="tiny muted">
                    {p.game_type === 'cash' ? 'Cash' : 'Torneo'} {p.venue === 'live' ? 'live' : 'online'}
                    {p.game_type === 'tournament' && p.tournament_name && ` · ${p.tournament_name}`}
                    {p.stake != null && ` · ${p.game_type === 'cash' ? 'NL' + p.stake : 'buy-in ' + eur(p.stake)}`}
                    {p.place && ` · ${p.place}`}
                    {d.banks.length > 1 && ` · ${bankName(p.bank_id)}`}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => window.confirm('¿Borrar este preset?') && d.deletePreset(p.id)}>
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ThemeCard />

      <AccountCards />

      <Card title="Cuenta">
        <p className="small muted">{d.user?.email}</p>
        <button className="btn btn-danger" onClick={() => d.signOut()}>
          Cerrar sesión
        </button>
      </Card>
    </>
  );
}
