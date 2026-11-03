'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { Field } from './ui';

export default function AuthForm() {
  const { signIn, signUp } = useData();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setMsg(err);
    setBusy(false);
  }

  return (
    <main className="center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src="/icons/icon-192.png" alt="" />
      <div>
        <h1>PokerBank</h1>
        <p className="muted">Sesiones y bankroll de póker.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <Field label="Correo">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña">
          <input
            className="input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {msg && <p className={msg.startsWith('Cuenta creada') ? 'muted small' : 'error'}>{msg}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </main>
  );
}
