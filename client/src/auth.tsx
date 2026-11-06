import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Me, User } from './types';
import { useT } from './i18n';

type AuthCtx = {
  me: Me;
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null });
  const [loading, setLoading] = useState(true);
  const { setLang } = useT();
  const langSynced = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await api.get<Me>('/api/auth/me');
      setMe(m);
      if (m.user && langSynced.current !== m.user.id) {
        langSynced.current = m.user.id;
        setLang(m.user.language);
      }
    } catch {
      /* offline: keep what we have */
    } finally {
      setLoading(false);
    }
  }, [setLang]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Heartbeat for students: counts minutes for the parent's daily time limit.
  useEffect(() => {
    if (me.user?.role !== 'student') return;
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await api.post<{ minutesToday: number; timeLimitReached: boolean }>('/api/auth/me/heartbeat');
        setMe((m) => ({ ...m, minutesToday: r.minutesToday, timeLimitReached: r.timeLimitReached }));
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(beat, 60_000);
    return () => window.clearInterval(id);
  }, [me.user?.id, me.user?.role]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const r = await api.post<{ user: User }>('/api/auth/login', { identifier, password });
      await refresh();
      return r.user;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    langSynced.current = null;
    setMe({ user: null });
    // drop cached API responses from the service worker
    if ('caches' in window) caches.delete('api').catch(() => {});
  }, []);

  const setUser = useCallback((u: User) => setMe((m) => ({ ...m, user: u })), []);

  return <Ctx.Provider value={{ me, user: me.user, loading, refresh, login, logout, setUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function homeFor(u: User | null) {
  if (!u) return '/welcome';
  if (u.role === 'admin') return '/admin';
  if (u.role === 'parent') return '/parent';
  return '/app';
}
