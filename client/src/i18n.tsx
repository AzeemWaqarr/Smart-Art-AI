import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';
import { UR } from './ur';

type Vars = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string, vars?: Vars) => string; ur: boolean };

const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (s) => s, ur: false });

function readStored(): Lang {
  try {
    return localStorage.getItem('sa_lang') === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** English strings are the keys; ur.ts maps them to Urdu. Missing keys fall back to English. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('sa_lang', l);
    } catch {
      /* private mode */
    }
  }, []);
  const t = useCallback((s: string, vars?: Vars) => fill(lang === 'ur' ? UR[s] ?? s : s, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, ur: lang === 'ur' }), [lang, setLang, t]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);

/** Sets <html dir/lang> while a student/parent screen is shown (admin stays LTR English). */
export function useDocumentDirection(active: boolean) {
  const { lang } = useT();
  useEffect(() => {
    const el = document.documentElement;
    const ur = active && lang === 'ur';
    el.lang = ur ? 'ur' : 'en';
    el.dir = ur ? 'rtl' : 'ltr';
    return () => {
      el.dir = 'ltr';
      el.lang = 'en';
    };
  }, [active, lang]);
}

/** Pick the Urdu or English field of an object. */
export function pick<T extends object>(lang: Lang, obj: T, en: keyof T, ur: keyof T) {
  return (lang === 'ur' && obj[ur] ? obj[ur] : obj[en]) as string;
}
