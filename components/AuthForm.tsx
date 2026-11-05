'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { Field } from './ui';

/** Pantalla para elegir contraseña nueva tras pulsar el enlace del correo de recuperación. */
export function NewPasswordForm() {
  const { updatePassword } = useData();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="center">
      <h1>Nueva contraseña</h1>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(await updatePassword(pw));
          setBusy(false);
        }}
      >
        <Field label="Elige tu nueva contraseña">
          <input className="input" type="password" autoComplete="new-password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {msg && <p className="error">{msg}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Un momento…' : 'Guardar contraseña'}
        </button>
      </form>
    </main>
  );
}

export default function AuthForm() {
  const { signIn, signUp, resetPassword } = useData();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === 'reset') {
      const e = await resetPassword(email.trim());
      setMsg(e ?? 'Te hemos enviado un correo con el enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.');
      setBusy(false);
      return;
    }
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
        {mode !== 'reset' && (
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
        )}
        {msg && <p className={/^(Cuenta creada|Te hemos enviado)/.test(msg) ? 'muted small' : 'error'}>{msg}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviarme el enlace'}
        </button>
        {mode === 'in' && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { setMode('reset'); setMsg(null); }}>
            He olvidado mi contraseña
          </button>
        )}
        {mode === 'up' && (
          <p className="tiny muted">
            Tus sesiones y tu bankroll se guardan en tu cuenta y solo los ves tú. Puedes exportarlos o borrar tu cuenta cuando quieras desde Ajustes.
          </p>
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'No tengo cuenta' : mode === 'up' ? 'Ya tengo cuenta' : 'Volver a entrar'}
        </button>
      </form>
    </main>
  );
}
