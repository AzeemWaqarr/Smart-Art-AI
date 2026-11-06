import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { useT } from '../i18n';
import { Icon } from '../components/Icon';
import { InstallButton } from '../components/Shell';
import { BackButton, ErrorState, Field, Segmented, Spinner, Switch, useAction, useFetch, useToast } from '../components/ui';
import type { Notification, User } from '../types';
import { getTheme, setTheme, type Theme } from '../theme';

export const PROMISES = [
  { icon: 'users', text: 'No public feed' },
  { icon: 'close', text: 'No chat with strangers' },
  { icon: 'lock', text: 'Drawings stay private' },
  { icon: 'pencil', text: 'The AI never draws for your child' },
];

export function Promises() {
  const { t } = useT();
  return (
    <div className="col" style={{ gap: 10 }}>
      <h2 className="h2">{t('Our safety promises')}</h2>
      <div className="grid-2">
        {PROMISES.map((p) => (
          <div key={p.text} className="card tight col" style={{ gap: 6, borderRadius: 16 }}>
            <Icon name={p.icon} size={22} color="var(--primary)" />
            <span className="bold" style={{ fontSize: 14, lineHeight: 1.35 }}>{t(p.text)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Student "Family" tab: who manages the account, safety promises and settings. */
export function StudentFamily() {
  const { t } = useT();
  const { me, user, setUser } = useAuth();
  const toast = useToast();
  if (!user) return null;
  const managed = !!user.parentId;
  const update = async (patch: Partial<User>) => {
    try {
      const r = await api.patch<{ user: User }>('/api/auth/me/settings', patch);
      setUser(r.user);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="screen with-nav">
      <div className="col" style={{ gap: 2 }}>
        <span className="eyebrow">{managed ? t('Family account') : t('Your account')}</span>
        <h1 className="h1">{t('Family & safety')}</h1>
      </div>

      <div className="card primary row" style={{ gap: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--accent)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="col grow" style={{ gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 900 }}>{user.name}</span>
          <span className="small" style={{ color: '#D5E3E5' }}>
            {managed ? t('Managed by {name}', { name: me.parent?.name || t('your parent') }) : user.email}
          </span>
        </div>
      </div>

      <Promises />

      <div className="col" style={{ gap: 10 }}>
        <h2 className="h2">{t('Settings')}</h2>
        <div className="list">
          <Switch on={user.weeklyReport} disabled={managed} onToggle={() => update({ weeklyReport: !user.weeklyReport })} title={t('Weekly progress report')} sub={managed ? t('Sent to your parent every Sunday') : t('A short summary every Sunday')} />
          {managed && <Switch on={user.shareTeacher} disabled title={t('Share progress with art teacher')} sub={t('Only the class dashboard, never photos')} onToggle={() => {}} />}
          <Switch on={user.dailyLimitOn} disabled={managed} onToggle={() => update({ dailyLimitOn: !user.dailyLimitOn })} title={t('Daily time limit')} sub={t('{n} minutes a day', { n: user.dailyLimitMin })} />
        </div>
        {managed && <span className="tiny muted">{t('Your parent can change these settings.')}</span>}
      </div>

      <div className="list">
        <Link to="/app/notifications" className="list-item"><Icon name="bell" size={22} /><span className="grow bold">{t('Notifications')}</span>{!!me.unread && <span className="tag try">{me.unread}</span>}<Icon name="next" size={18} className="flip" /></Link>
        <Link to="/app/account" className="list-item"><Icon name="settings" size={22} /><span className="grow bold">{t('Account & settings')}</span><Icon name="next" size={18} className="flip" /></Link>
      </div>
    </div>
  );
}

/** Profile, language, password and logout. Used by students and parents. */
export function Account({ backTo }: { backTo: string }) {
  const { t, lang, setLang } = useT();
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [pw, setPw] = useState({ current: '', next: '' });
  const pwAct = useAction();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const delAct = useAction();
  if (!user) return null;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.patch<{ user: User }>('/api/auth/me', { name });
      setUser(r.user);
      toast(t('Saved'));
    } catch (er) {
      toast((er as Error).message, 'error');
    }
  };
  const saveLang = async (l: 'en' | 'ur') => {
    try {
      const r = await api.patch<{ user: User }>('/api/auth/me', { language: l });
      setUser(r.user);
    } catch {
      /* local toggle still works */
    }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    const r = await pwAct.run(() => api.post('/api/auth/me/password', pw));
    if (r) {
      setPw({ current: '', next: '' });
      toast(t('Password changed'));
    }
  };
  const del = async () => {
    const p = prompt(t('Type your password to delete your account and all drawings forever.'));
    if (!p) return;
    const r = await delAct.run(() => api.del('/api/auth/me', { password: p }));
    if (r) {
      await logout();
      nav('/welcome', { replace: true });
    } else toast(delAct.error || t('Could not delete'), 'error');
  };

  return (
    <div className="screen with-nav">
      <div className="row">
        <BackButton to={backTo} />
        <h1 className="h1 grow" style={{ fontSize: 22 }}>{t('Account & settings')}</h1>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span className="label">{t('Language')}</span>
        <Segmented
          square
          label={t('Language')}
          value={lang}
          onChange={(l) => {
            setLang(l);
            void saveLang(l);
          }}
          options={[
            { id: 'en', label: 'English', className: 'latin' },
            { id: 'ur', label: 'اردو', className: 'ur' },
          ]}
        />
        <span className="tiny muted">{lang === 'ur' ? 'تجاویز اور ایپ اردو میں دکھائی جائیں گی۔' : 'Tips and the app will be shown in English.'}</span>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span className="label">{t('Appearance')}</span>
        <Segmented
          square
          label={t('Appearance')}
          value={theme}
          onChange={(v) => {
            setThemeState(v);
            setTheme(v);
          }}
          options={[
            { id: 'system', label: t('Auto') },
            { id: 'light', label: t('Light') },
            { id: 'dark', label: t('Dark') },
          ]}
        />
      </div>

      <form className="card col" style={{ gap: 10 }} onSubmit={saveName}>
        <Field label={t('Name')} id="nm">
          <input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </Field>
        <span className="small muted latin">{user.email || (user.username ? `@${user.username}` : '')}</span>
        <button className="btn sm outline" style={{ alignSelf: 'flex-start' }}>{t('Save')}</button>
      </form>

      {!user.parentId && (
        <form className="card col" style={{ gap: 10 }} onSubmit={changePw}>
          <span className="h3">{t('Change password')}</span>
          <Field label={t('Current password')} id="cp">
            <input id="cp" className="input latin" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </Field>
          <Field label={t('New password')} id="np" hint={t('At least 8 characters.')}>
            <input id="np" className="input latin" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          </Field>
          {pwAct.error && <div className="error-box">{pwAct.error}</div>}
          <button className="btn sm outline" style={{ alignSelf: 'flex-start' }} disabled={pwAct.busy}>{t('Change password')}</button>
        </form>
      )}

      <InstallButton />

      <button
        className="btn light block"
        onClick={async () => {
          await logout();
          nav('/welcome', { replace: true });
        }}
      >
        <Icon name="logout" size={20} className="flip" /> {t('Log out')}
      </button>
      {!user.parentId && (
        <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={del}>
          {t('Delete my account')}
        </button>
      )}
    </div>
  );
}

export function Notifications({ backTo }: { backTo: string }) {
  const { t, lang } = useT();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useFetch<{ notifications: Notification[] }>('/api/notifications');
  const markAll = async () => {
    await api.post('/api/notifications/read').catch(() => {});
    await Promise.all([reload(), refresh()]);
  };
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const list = data!.notifications;
  return (
    <div className="screen with-nav">
      <div className="row">
        <BackButton to={backTo} />
        <h1 className="h1 grow" style={{ fontSize: 22 }}>{t('Notifications')}</h1>
        {list.some((n) => !n.read) && <button className="btn ghost sm" onClick={markAll}>{t('Mark all read')}</button>}
      </div>
      {list.length === 0 ? (
        <div className="center-fill">
          <Icon name="bell" size={36} color="var(--soft)" />
          <span className="muted">{t('Nothing new yet.')}</span>
        </div>
      ) : (
        <div className="list">
          {list.map((n) => (
            <button
              key={n.id}
              type="button"
              className="list-item"
              style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}
              onClick={async () => {
                if (!n.read) await api.post('/api/notifications/read').catch(() => {});
                void refresh();
                if (n.link) nav(n.link);
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, flexShrink: 0, background: n.read ? 'transparent' : 'var(--coral)' }} />
              <span className="col grow" style={{ gap: 2 }}>
                <span className="bold">{n.title}</span>
                <span className="small muted">{n.body}</span>
              </span>
              <span className="tiny muted" style={{ flexShrink: 0 }}>{timeAgo(n.createdAt, lang)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
