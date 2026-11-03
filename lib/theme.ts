export type ThemePref = 'dark' | 'light' | 'auto';

export const THEME_KEY = 'pb.pref.theme';

export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref === 'auto') {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  const t = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f4f6f9' : '#0b0f14');
}

/** Script que se ejecuta antes de pintar para evitar el parpadeo de tema. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${THEME_KEY}')||'"dark"');var t=p==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;
