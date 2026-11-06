import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useDocumentDirection, useT } from '../i18n';
import type { Lang, User } from '../types';
import { Icon } from './Icon';
import { Sheet } from './ui';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Offline banner + "new version" prompt. */
export function AppBanners() {
  const online = useOnline();
  const { t } = useT();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <>
      {!online && <div className="banner dark">{t("You're offline. You can still look at saved lessons and progress.")}</div>}
      {needRefresh && (
        <div className="banner">
          {t('A new version of Smart Art is ready.')}{' '}
          <button className="btn link" style={{ color: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={() => updateServiceWorker(true)}>
            {t('Update')}
          </button>
        </div>
      )}
    </>
  );
}

/** "Add to home screen" prompt for browsers that support it. */
export function InstallButton({ className = 'btn ghost sm' }: { className?: string }) {
  const { t } = useT();
  const [evt, setEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt) return null;
  return (
    <button
      className={className}
      onClick={async () => {
        await evt.prompt();
        setEvt(null);
      }}
    >
      <Icon name="download" size={18} /> {t('Install app')}
    </button>
  );
}

/** EN / اردو switch in the header. Saves the choice to the account when signed in. */
function BarLang() {
  const { lang, setLang, t } = useT();
  const { user, setUser } = useAuth();
  const pick = (l: Lang) => {
    setLang(l);
    if (user && user.language !== l) api.patch<{ user: User }>('/api/auth/me', { language: l }).then((r) => setUser(r.user)).catch(() => {});
  };
  return (
    <div className="lang" role="group" aria-label={t('Language')}>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => pick('en')}>EN</button>
      <button type="button" className="ur" aria-pressed={lang === 'ur'} onClick={() => pick('ur')}>اردو</button>
    </div>
  );
}

type MenuItem = { to: string; icon: string; label: string; badge?: number };

function AppBar({ sub, menu }: { sub: string; menu?: MenuItem[] }) {
  const { user, me, logout } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header className="bar">
      <img className="logo" src="/logo.png" alt="" />
      <div>
        <b>Smart Art</b>
        <small>{sub}</small>
      </div>
      <div className="end">
        <BarLang />
        {user && menu && (
          <button type="button" className="avatar" aria-label={t('Menu')} onClick={() => setOpen(true)}>
            {user.name.charAt(0).toUpperCase()}
            {!!me.unread && <span className="dot" />}
          </button>
        )}
      </div>
      {user && menu && (
        <Sheet open={open} onClose={() => setOpen(false)} label={t('Menu')}>
          <div className="row">
            <span className="avatar" style={{ width: 44, height: 44, fontSize: 19 }}>{user.name.charAt(0).toUpperCase()}</span>
            <div className="col grow" style={{ gap: 0 }}>
              <h3>{user.name}</h3>
              <span className="small muted latin">{user.email || (user.username ? `@${user.username}` : '')}</span>
            </div>
          </div>
          <div className="list">
            {menu.map((m) => (
              <Link key={m.to} to={m.to} className="list-item" onClick={() => setOpen(false)}>
                <Icon name={m.icon} size={22} color="var(--teal)" />
                <span className="grow bold">{m.label}</span>
                {!!m.badge && <span className="tag try">{m.badge}</span>}
                <Icon name="next" size={18} className="flip" />
              </Link>
            ))}
          </div>
          <button
            className="btn ghost block"
            onClick={async () => {
              setOpen(false);
              await logout();
              nav('/welcome', { replace: true });
            }}
          >
            <Icon name="logout" size={20} className="flip" /> {t('Log out')}
          </button>
        </Sheet>
      )}
    </header>
  );
}

/** The app layout: header, scrolling content, tabs. Full screen on every device
    (tabs at the bottom on phones, under the header on wider screens). */
export function Device({ children, sub, menu, tabs }: { children: ReactNode; sub?: string; menu?: MenuItem[]; tabs?: ReactNode }) {
  useDocumentDirection(true);
  const { t } = useT();
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <div className="device">
      <AppBar sub={sub || t('Your AI art coach')} menu={menu} />
      <AppBanners />
      <main className="main" ref={main} id="main">
        {children}
      </main>
      {tabs}
    </div>
  );
}

/** Screens before login (welcome, login, sign-up). */
export function PhoneShell({ children }: { children?: ReactNode }) {
  return <Device>{children ?? <Outlet />}</Device>;
}

const TAB_ICONS: Record<string, ReactNode> = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  coach: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  lessons: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.5c-3-1.8-6-2-9-1.5V5c3-.5 6-.3 9 1.5 3-1.8 6-2 9-1.5v14c-3-.5-6-.3-9 1.5zM12 6.5v14" /></svg>,
  family: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></svg>,
  plans: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z" /></svg>,
  alerts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0" /></svg>,
  account: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0" /></svg>,
};

export function Tabs({ items, label }: { items: { to: string; icon: string; label: string; end?: boolean; dot?: boolean; match?: RegExp }[]; label: string }) {
  const loc = useLocation();
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((i) => {
        const active = i.match ? i.match.test(loc.pathname) : undefined;
        return (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => ((active ?? isActive) ? 'active' : '')} aria-current={(active ?? undefined) ? 'page' : undefined}>
            {TAB_ICONS[i.icon]}
            <span>{i.label}</span>
            {i.dot && <span className="dot" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Student area: header bar, Home / Coach / Lessons tabs, daily time limit lock. */
export function StudentLayout() {
  const { me } = useAuth();
  const { t } = useT();
  const menu: MenuItem[] = [
    { to: '/app/progress', icon: 'chart', label: t('My progress') },
    { to: '/app/drawings', icon: 'photo', label: t('My drawings') },
    { to: '/app/family', icon: 'shield', label: t('Family & safety') },
    { to: '/app/notifications', icon: 'bell', label: t('Notifications'), badge: me.unread },
    { to: '/app/account', icon: 'settings', label: t('Account & settings') },
  ];
  const tabs = (
    <Tabs
      label={t('App sections')}
      items={[
        { to: '/app', icon: 'home', label: t('Home'), end: true },
        { to: '/app/coach', icon: 'coach', label: t('Coach'), match: /^\/app\/(coach|drawings)/ },
        { to: '/app/lessons', icon: 'lessons', label: t('Lessons') },
      ]}
    />
  );
  if (me.timeLimitReached) {
    return (
      <Device menu={menu}>
        <div className="center-fill" style={{ gap: 16 }}>
          <div style={{ width: 88, height: 88, borderRadius: 44, background: 'var(--sun)', display: 'grid', placeItems: 'center', color: 'var(--sun-ink)' }}>
            <Icon name="clock" size={44} />
          </div>
          <h2>{t("Time's up for today")}</h2>
          <p className="muted">{t('You reached your {n} minutes. Rest your eyes, keep drawing on paper, and come back tomorrow!', { n: me.user?.dailyLimitMin ?? 30 })}</p>
        </div>
      </Device>
    );
  }
  return (
    <Device menu={menu} tabs={tabs}>
      <Outlet />
    </Device>
  );
}
