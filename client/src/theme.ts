export type Theme = 'system' | 'light' | 'dark';

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('sa_theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Applies the saved theme ("system" follows the device setting). */
export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0A3A41' : '#0E4A53');
}

export function setTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem('sa_theme');
    else localStorage.setItem('sa_theme', t);
  } catch {
    /* private mode */
  }
  applyTheme(t);
}
