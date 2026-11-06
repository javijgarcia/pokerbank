export const APP_VERSION = '0.7.0';

/** Correo al que llega el feedback de los probadores. Se define en .env.local (NEXT_PUBLIC_FEEDBACK_EMAIL). */
export const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL ?? '';
