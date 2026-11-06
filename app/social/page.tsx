'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { hoursLabel } from '@/lib/format';
import {
  acceptFriend,
  createProfile,
  friendStats,
  lookupProfile,
  removeFriendship,
  requestFriend,
  unpublishPost,
  updateProfile,
  useSocial,
  type FriendStats,
  type Friendship,
  type Profile,
  type SharedSession,
} from '@/lib/social';
import PostCard, { roiLabel } from '@/components/PostCard';
import { Card, Field, Segmented, tone } from '@/components/ui';

function ProfileSetup({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return setErr('El usuario debe tener 3-20 caracteres: letras minúsculas, números o _.');
    if (!name.trim()) return setErr('Elige el nombre que verán tus amigos.');
    setBusy(true);
    const e2 = await createProfile({ username, display_name: name.trim(), show_stats: show });
    setBusy(false);
    if (e2) return setErr(e2);
    onDone();
  }

  return (
    <Card title="Crea tu perfil">
      <p className="small muted">Para añadir amigos y ver su feed necesitas un nombre de usuario. Tus sesiones y tu dinero siguen siendo privados: solo se comparte lo que tú publiques, y nunca en euros.</p>
      <form className="stack" onSubmit={save}>
        <Field label="Nombre de usuario (único)">
          <input className="input" value={username} autoCapitalize="none" autoCorrect="off" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="javi_poker" maxLength={20} />
        </Field>
        <Field label="Nombre visible">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Javi" maxLength={40} />
        </Field>
        <label className="row small" style={{ gap: 10 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Mostrar a mis amigos mis estadísticas (sesiones, horas, ROI % e ITM %)
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creando…' : 'Crear perfil'}
        </button>
      </form>
    </Card>
  );
}

function FriendRow({ f, other, onRemove }: { f: Friendship; other: Profile | undefined; onRemove: (id: string) => void }) {
  const [stats, setStats] = useState<FriendStats | null | undefined>(undefined);
  const uid = other?.user_id;
  useEffect(() => {
    if (uid && other?.show_stats) void friendStats(uid).then(setStats);
    else setStats(null);
  }, [uid, other?.show_stats]);

  return (
    <div className="item" style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <strong>{other?.display_name ?? 'Jugador'}</strong> <span className="small muted">@{other?.username}</span>
        <div className="small muted">
          {stats === undefined
            ? 'Cargando…'
            : stats
              ? `${stats.sessions} sesiones · ${hoursLabel(stats.hours * 3600)}${stats.roi_pct != null ? ' · ROI ' : ''}`
              : other?.show_stats
                ? 'Aún sin sesiones'
                : 'Estadísticas privadas'}
          {stats?.roi_pct != null && <span className={`num ${tone(stats.roi_pct)}`}>{roiLabel(stats.roi_pct)}</span>}
          {stats?.itm_pct != null && ` · ITM ${stats.itm_pct.toLocaleString('es-ES')} %`}
        </div>
      </div>
      <button className="btn btn-sm btn-danger" onClick={() => window.confirm('¿Quitar a este amigo?') && onRemove(f.id)}>
        Quitar
      </button>
    </div>
  );
}

export default function SocialPage() {
  const d = useData();
  const uid = d.user?.id;
  const s = useSocial(uid);
  const [tab, setTab] = useState<'feed' | 'friends'>('feed');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ user_id: string; username: string; display_name: string } | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);

  const accepted = useMemo(() => s.friendships.filter((f) => f.status === 'accepted'), [s.friendships]);
  const incoming = useMemo(() => s.friendships.filter((f) => f.status === 'pending' && f.addressee_id === uid), [s.friendships, uid]);
  const outgoing = useMemo(() => s.friendships.filter((f) => f.status === 'pending' && f.requester_id === uid), [s.friendships, uid]);
  const otherId = (f: Friendship) => (f.requester_id === uid ? f.addressee_id : f.requester_id);

  async function act(p: Promise<string | null>) {
    const e = await p;
    setMsg(e);
    await s.refresh();
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setFound(undefined);
    if (!query.trim()) return;
    const r = await lookupProfile(query.replace(/^@/, ''));
    if (r.error) return setMsg(r.error);
    setFound(r.profile);
  }

  async function sendRequest(userId: string) {
    const e = await requestFriend(userId);
    setMsg(e ?? 'Solicitud enviada.');
    if (!e) {
      setFound(undefined);
      setQuery('');
    }
    await s.refresh();
  }

  if (s.loading) return <><h1>Social</h1><p className="muted">Cargando…</p></>;
  if (s.unavailable) return <><h1>Social</h1><Card><p className="error">{s.error}</p></Card></>;
  if (!s.me) return <><h1>Social</h1><ProfileSetup onDone={() => void s.refresh()} /></>;

  const alreadyLinked = found ? s.friendships.some((f) => f.requester_id === found.user_id || f.addressee_id === found.user_id) : false;

  return (
    <>
      <h1>Social</h1>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'feed', label: 'Feed' },
          { value: 'friends', label: incoming.length ? `Amigos (${incoming.length})` : 'Amigos' },
        ]}
      />
      {msg && <p className={/enviada/.test(msg) ? 'muted small' : 'error'}>{msg}</p>}

      {tab === 'feed' && (
        <>
          {s.feed.length === 0 ? (
            <Card>
              <p className="muted small">
                Aquí aparecerán las sesiones que tú y tus amigos publiquéis. Publica una desde el botón «Compartir» del Historial, o al cerrar una sesión. Solo se ven porcentajes y tiempos, nunca euros.
              </p>
            </Card>
          ) : (
            s.feed.map((p: SharedSession) => (
              <PostCard key={p.id} post={p} author={s.profiles[p.user_id]} mine={p.user_id === uid} onDelete={(x) => void act(unpublishPost(x.id))} />
            ))
          )}
        </>
      )}

      {tab === 'friends' && (
        <>
          <Card title="Mi perfil">
            <div>
              <strong>{s.me.display_name}</strong> <span className="small muted">@{s.me.username}</span>
            </div>
            <label className="row small" style={{ gap: 10 }}>
              <input type="checkbox" checked={s.me.show_stats} onChange={(e) => void act(updateProfile(s.me!.user_id, { show_stats: e.target.checked }))} />
              Mostrar mis estadísticas (sesiones, horas, ROI % e ITM %) a mis amigos
            </label>
          </Card>

          <Card title="Añadir amigo">
            <form className="row" onSubmit={search}>
              <input className="input grow" aria-label="Usuario del amigo" placeholder="Su nombre de usuario" autoCapitalize="none" value={query} onChange={(e) => setQuery(e.target.value.toLowerCase())} />
              <button className="btn">Buscar</button>
            </form>
            {found === null && <p className="small muted">No hay ningún usuario con ese nombre.</p>}
            {found && (
              <div className="item">
                <div>
                  <strong>{found.display_name}</strong> <span className="small muted">@{found.username}</span>
                </div>
                <button className="btn btn-primary btn-sm" disabled={alreadyLinked} onClick={() => void sendRequest(found.user_id)}>
                  {alreadyLinked ? 'Ya conectados' : 'Enviar solicitud'}
                </button>
              </div>
            )}
          </Card>

          {incoming.length > 0 && (
            <Card title="Solicitudes recibidas">
              <div className="list">
                {incoming.map((f) => {
                  const o = s.profiles[otherId(f)];
                  return (
                    <div className="item" key={f.id}>
                      <div>
                        <strong>{o?.display_name ?? 'Jugador'}</strong> <span className="small muted">@{o?.username}</span>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => void act(acceptFriend(f.id))}>
                          Aceptar
                        </button>
                        <button className="btn btn-sm" onClick={() => void act(removeFriendship(f.id))}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {outgoing.length > 0 && (
            <Card title="Solicitudes enviadas">
              <div className="list">
                {outgoing.map((f) => {
                  const o = s.profiles[otherId(f)];
                  return (
                    <div className="item" key={f.id}>
                      <div>
                        <strong>{o?.display_name ?? 'Solicitud enviada'}</strong> <span className="small muted">{o ? `@${o.username} · ` : ''}pendiente</span>
                      </div>
                      <button className="btn btn-sm" onClick={() => void act(removeFriendship(f.id))}>
                        Cancelar
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card title={`Amigos (${accepted.length})`}>
            {accepted.length === 0 ? (
              <p className="muted small">Todavía no tienes amigos. Busca a alguien por su nombre de usuario.</p>
            ) : (
              <div className="list">
                {accepted.map((f) => (
                  <FriendRow key={f.id} f={f} other={s.profiles[otherId(f)]} onRemove={(id) => void act(removeFriendship(id))} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
