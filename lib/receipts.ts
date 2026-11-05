import { supabase } from './supabase';

const BUCKET = 'receipts';

/** Reduce la foto (lado máximo 1600 px, JPEG) para que pese poco y suba rápido desde el móvil. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', quality)
  );
}

/** Sube el recibo a Storage. Devuelve la ruta, o lanza un error con el motivo. */
export async function uploadReceipt(userId: string, sessionId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Sin conexión');
  const blob = await compressImage(file);
  const path = `${userId}/${sessionId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Falta ejecutar la migración 005 en Supabase.' : error.message);
  return path;
}

/** URL temporal (1 h) para ver un recibo; el bucket es privado. */
export async function receiptUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function removeReceipt(path: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
