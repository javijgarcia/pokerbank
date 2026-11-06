export const APP_VERSION = '0.7.2';

/** Correo al que llega el feedback de los probadores. Se define en .env.local (NEXT_PUBLIC_FEEDBACK_EMAIL). */
export const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL ?? '';

/** Nombre de la app (provisional hasta el rebranding): se usa en la landing y en la tarjeta de resultado. */
export const APP_NAME = 'PokerBank';
