import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useT } from '../i18n';
import { useAuth } from '../auth';
import type { Lang, User } from '../types';
import { Icon } from './Icon';

// ------------------------------------------------------------------ data loading
export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get<T>(url);
      if (n === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError(e as ApiError);
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

// ------------------------------------------------------------------ toast
type ToastMsg = { text: string; kind: 'ok' | 'error'; id: number };
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const show = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => setMsg({ text, kind, id: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div key={msg.id} className={`toast ${msg.kind === 'error' ? 'error' : ''}`} role="status" aria-live="polite">
          <Icon name={msg.kind === 'error' ? 'close' : 'check'} size={18} />
          <span>{msg.text}</span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ------------------------------------------------------------------ small pieces
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="center-fill" role="status">
      <div className="spinner" />
      {label && <span className="muted small">{label}</span>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error | null; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="center-fill">
      <Icon name={(error as ApiError)?.code === 'offline' ? 'wifiOff' : 'close'} size={36} color="var(--soft)" />
      <p className="bold">{error?.message || t('Something went wrong.')}</p>
      {onRetry && (
        <button className="btn outline sm" onClick={onRetry}>
          {t('Try again')}
        </button>
      )}
    </div>
  );
}

export function BackButton({ to, label }: { to?: string; label?: string }) {
  const nav = useNavigate();
  const { t } = useT();
  const props = { className: 'icon-btn', 'aria-label': label || t('Back') };
  const icon = <Icon name="back" size={22} className="flip" />;
  if (to) return <Link to={to} {...props}>{icon}</Link>;
  return (
    <button type="button" {...props} onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}>
      {icon}
    </button>
  );
}

export function Header({ title, eyebrow, back, right }: { title: string; eyebrow?: string; back?: string | true; right?: ReactNode }) {
  return (
    <div className="row">
      {back && <BackButton to={back === true ? undefined : back} />}
      <div className="col grow" style={{ gap: 0 }}>
        {eyebrow && <span className="eyebrow" style={{ color: 'var(--red)' }}>{eyebrow}</span>}
        <h1 className="h1" style={{ fontSize: back ? 22 : 26 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label, square, dark }: { options: { id: T; label: ReactNode; className?: string }[]; value: T; onChange: (v: T) => void; label: string; square?: boolean; dark?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`seg ${square ? 'square' : ''} ${dark ? 'dark' : ''}`}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} className={o.className} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LangToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useT();
  const { user, setUser } = useAuth();
  const change = (l: Lang) => {
    setLang(l);
    // remember the choice on the account so it follows the user to other devices
    if (user && user.language !== l) api.patch<{ user: User }>('/api/auth/me', { language: l }).then((r) => setUser(r.user)).catch(() => {});
  };
  return (
    <Segmented
      label={t('Tips language')}
      square={!compact}
      value={lang}
      onChange={change}
      options={[
        { id: 'en', label: compact ? 'EN' : 'English', className: 'latin' },
        { id: 'ur', label: 'اردو', className: 'ur' },
      ]}
    />
  );
}

export function Switch({ on, onToggle, title, sub, disabled }: { on: boolean; onToggle: () => void; title: string; sub?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="list-item" onClick={onToggle} disabled={disabled} style={{ minHeight: 64 }}>
      <span className="col grow" style={{ gap: 2 }}>
        <span className="bold">{title}</span>
        {sub && <span className="small muted">{sub}</span>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        {children}
      </div>
    </div>
  );
}

/** Run an async action with busy + error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

export function skillWord(score: number, t: (s: string) => string) {
  if (score >= 90) return t('Great');
  if (score >= 75) return t('Good');
  if (score >= 50) return t('Getting better');
  if (score > 0) return t('Keep practising');
  return t('Not yet');
}

export function skillPill(score: number, t: (s: string) => string) {
  if (score >= 85) return { text: t('Great'), cls: 'good' };
  if (score >= 65) return { text: t('Good'), cls: 'good' };
  return { text: t('Try this'), cls: 'try' };
}

export const SKILL_LABEL: Record<string, string> = { colour: 'Colour', light: 'Light', proportion: 'Proportion', composition: 'Composition' };
