'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { drawShareCard, shareImage } from '@/lib/sharecard';
import { publishSession, toShared, unpublishPost, useSocial } from '@/lib/social';
import type { Session } from '@/lib/types';
import PostCard from './PostCard';
import { Field } from './ui';

/** Hoja para compartir una sesión: publicarla en el feed de amigos o enviar la tarjeta como imagen. */
export default function ShareSheet({ s, onClose }: { s: Session; onClose: () => void }) {
  const d = useData();
  const social = useSocial(d.user?.id);
  const [caption, setCaption] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string | null>(null);

  const draft = toShared(s, caption);
  const post = social.feed.find((p) => p.user_id === d.user?.id && p.session_id === s.id);
  const name = social.me?.display_name ?? '';

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void drawShareCard(toShared(s, ''), name)
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setImg(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [s, name]);

  async function publish() {
    setBusy(true);
    const e = await publishSession(s, caption);
    await social.refresh();
    setBusy(false);
    setMsg(e ?? 'Publicada en tu feed.');
  }

  async function unpublish() {
    if (!post) return;
    setBusy(true);
    const e = await unpublishPost(post.id);
    await social.refresh();
    setBusy(false);
    setMsg(e ?? 'Quitada del feed.');
  }

  async function sendImage() {
    setBusy(true);
    try {
      const downloaded = await shareImage(await drawShareCard(draft, name));
      setMsg(downloaded ? 'Imagen descargada.' : null);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compartir sesión"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 55 }}
    >
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Compartir</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="tiny muted">Solo se comparte el ROI en %, el tiempo y el resultado deportivo. Nunca importes en euros.</p>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Vista previa de la tarjeta" style={{ width: '100%', borderRadius: 12 }} />
        )}
        <button className="btn" disabled={busy} onClick={sendImage}>
          Compartir imagen
        </button>

        <h3 style={{ margin: '8px 0 0' }}>Feed de amigos</h3>
        {social.loading ? (
          <p className="small muted">Cargando…</p>
        ) : social.unavailable ? (
          <p className="error small">{social.error}</p>
        ) : !social.me ? (
          <p className="small muted">Crea tu perfil en la pestaña Social para publicar en el feed.</p>
        ) : post ? (
          <>
            <PostCard post={post} author={social.me} mine />
            <button className="btn btn-danger" disabled={busy} onClick={unpublish}>
              Quitar del feed
            </button>
          </>
        ) : (
          <>
            <Field label="Comentario (opcional)">
              <input className="input" maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Run good, final table…" />
            </Field>
            <button className="btn btn-primary" disabled={busy} onClick={publish}>
              Publicar en el feed
            </button>
          </>
        )}
        {msg && <p className={/Publicada|Quitada|descargada/.test(msg) ? 'small muted' : 'error'}>{msg}</p>}
      </div>
    </div>
  );
}
