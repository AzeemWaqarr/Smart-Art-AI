import { useState, type FormEvent } from 'react';
import { Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useT } from '../i18n';
import { Icon } from '../components/Icon';
import { Device, Tabs } from '../components/Shell';
import { BackButton, ErrorState, Field, Segmented, Spinner, Switch, useAction, useFetch, useToast } from '../components/ui';
import { Promises } from './Account';
import { ProgressView } from './Progress';
import { DrawingThumb } from './Home';
import type { Drawing, User } from '../types';

type Child = User & { week: { drawings: number; practices: number; minutes: number }; streak: number; minutesToday: number };
type FamilyData = { children: Child[] };

export function ParentLayout() {
  const { t } = useT();
  const { me } = useAuth();
  const tabs = (
    <Tabs
      label={t('App sections')}
      items={[
        { to: '/parent', icon: 'family', label: t('Family'), end: true, match: /^\/parent(\/children|\/drawings)?(\/|$)/ },
        { to: '/parent/notifications', icon: 'alerts', label: t('Alerts'), dot: !!me.unread },
        { to: '/parent/account', icon: 'account', label: t('Account') },
      ]}
    />
  );
  return (
    <Device sub={t('Parent account')} tabs={tabs}>
      <Outlet />
    </Device>
  );
}

function ChildSettings({ child, onChange }: { child: Child | User; onChange: (u: User) => void }) {
  const { t } = useT();
  const toast = useToast();
  const update = async (patch: Partial<User>) => {
    try {
      const r = await api.patch<{ child: User }>(`/api/family/children/${child.id}`, patch);
      onChange(r.child);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <h2 className="h2">{t('Settings')}</h2>
      <div className="list">
        <Switch on={child.weeklyReport} onToggle={() => update({ weeklyReport: !child.weeklyReport })} title={t('Weekly progress report')} sub={t('A short summary every Sunday in your alerts')} />
        <Switch on={child.shareTeacher} onToggle={() => update({ shareTeacher: !child.shareTeacher })} title={t('Share progress with art teacher')} sub={t('Only the class dashboard, never photos')} />
        <Switch on={child.dailyLimitOn} onToggle={() => update({ dailyLimitOn: !child.dailyLimitOn })} title={t('Daily time limit')} sub={t('{n} minutes a day', { n: child.dailyLimitMin })} />
        {child.dailyLimitOn && (
          <div className="list-item">
            <span className="grow small bold">{t('Minutes per day')}</span>
            <Segmented
              label={t('Minutes per day')}
              value={String(child.dailyLimitMin)}
              onChange={(v) => update({ dailyLimitMin: Number(v) })}
              options={['15', '30', '45', '60'].map((m) => ({ id: m, label: m }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ParentHome() {
  const { t } = useT();
  const { user } = useAuth();
  const { data, error, loading, reload, setData } = useFetch<FamilyData>('/api/family');
  const [sel, setSel] = useState<string>('');

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const f = data!;
  const child = f.children.find((c) => c.id === sel) || f.children[0];

  return (
    <div className="screen with-nav">
      <div className="between">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{t('Parent account')}</span>
          <h1 className="h1">{t('Family & safety')}</h1>
        </div>
        <Link to="/parent/children/new" className="btn sm outline"><Icon name="plus" size={18} /> {t('Add child')}</Link>
      </div>

      {f.children.length === 0 ? (
        <div className="card col center" style={{ alignItems: 'center', padding: 28, gap: 10 }}>
          <Icon name="users" size={36} color="var(--primary)" />
          <span className="h3">{t('Welcome, {name}!', { name: user?.name || '' })}</span>
          <span className="small muted">{t('Add your child to give them their own safe Smart Art login.')}</span>
          <Link to="/parent/children/new" className="btn">{t('Add my child')}</Link>
        </div>
      ) : (
        <>
          {f.children.length > 1 && (
            <Segmented label={t('Choose a child')} value={child.id} onChange={setSel} options={f.children.map((c) => ({ id: c.id, label: c.name }))} />
          )}
          <Link to={`/parent/children/${child.id}`} className="card primary row" style={{ gap: 14, color: '#fff' }}>
            <span style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--accent)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>
              {child.name.charAt(0).toUpperCase()}
            </span>
            <div className="col grow" style={{ gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 900 }}>
                {child.name}
                {child.birthYear ? ` · ${t('age {n}', { n: new Date().getFullYear() - child.birthYear })}` : ''}
              </span>
              <span className="small" style={{ color: '#D5E3E5' }}>
                {t('This week: {d} drawings · {m} minutes practising', { d: child.week.drawings, m: child.week.minutes })}
              </span>
            </div>
            <Icon name="next" size={20} className="flip" />
          </Link>
          <div className="grid-3">
            <div className="card tight col center" style={{ alignItems: 'center', gap: 0 }}><span className="h2 latin">{child.streak}</span><span className="tiny muted bold">{t('day streak')}</span></div>
            <div className="card tight col center" style={{ alignItems: 'center', gap: 0 }}><span className="h2 latin">{child.minutesToday}</span><span className="tiny muted bold">{t('min today')}</span></div>
            <div className="card tight col center" style={{ alignItems: 'center', gap: 0 }}><span className="h2 latin">{child.week.practices}</span><span className="tiny muted bold">{t('lessons this week')}</span></div>
          </div>
        </>
      )}

      <Promises />

      {child && (
        <ChildSettings
          child={child}
          onChange={(u) => setData({ ...f, children: f.children.map((c) => (c.id === u.id ? { ...c, ...u } : c)) })}
        />
      )}

    </div>
  );
}

export function AddChild() {
  const { t, lang } = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const toast = useToast();
  const year = new Date().getFullYear();
  const [f, setF] = useState({ name: '', username: '', password: '', birthYear: String(year - 10), language: lang });
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.post<{ child: User }>('/api/family/children', { ...f, birthYear: Number(f.birthYear) }));
    if (r) {
      toast(t('{name} can now log in with username "{u}"', { name: r.child.name, u: r.child.username || '' }));
      nav('/parent', { replace: true });
    }
  };
  return (
    <form className="screen with-nav" onSubmit={submit}>
      <div className="row">
        {!first && <BackButton to="/parent" />}
        <div className="col" style={{ gap: 0 }}>
          {first && <span className="eyebrow">{t('Step 2 of 2')}</span>}
          <h1 className="h1" style={{ fontSize: 24 }}>{t('Add your child')}</h1>
        </div>
      </div>
      <p className="muted small">{t('Your child logs in with a username and password you choose. No email or phone number needed.')}</p>
      <Field label={t("Child's first name")} id="cn">
        <input id="cn" className="input" value={f.name} onChange={set('name')} required maxLength={60} />
      </Field>
      <Field label={t('Username')} id="cu" hint={t('Letters and numbers only, e.g. ayesha11')}>
        <input id="cu" className="input latin" autoCapitalize="none" autoComplete="off" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} required minLength={3} maxLength={30} />
      </Field>
      <Field label={t('Password for your child')} id="cpw" hint={t('At least 6 characters. Write it down for them.')}>
        <input id="cpw" className="input latin" type="text" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={6} />
      </Field>
      <div className="grid-2">
        <Field label={t('Birth year')} id="cby">
          <select id="cby" className="input latin" value={f.birthYear} onChange={set('birthYear')}>
            {Array.from({ length: 16 }, (_, i) => year - 3 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label={t('Tips language')} id="cl">
          <select id="cl" className="input" value={f.language} onChange={set('language')}>
            <option value="en">English</option>
            <option value="ur">اردو</option>
          </select>
        </Field>
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn lg block" disabled={busy}>{busy ? t('Creating…') : t('Create child login')}</button>
      {first && <Link to="/parent" className="btn ghost block">{t('Skip for now')}</Link>}
    </form>
  );
}

export function ChildDetail() {
  const { id } = useParams();
  const { t } = useT();
  const nav = useNavigate();
  const toast = useToast();
  const fam = useFetch<FamilyData>('/api/family');
  const drawings = useFetch<{ drawings: Drawing[] }>(`/api/drawings?userId=${id}`, [id]);
  const [tab, setTab] = useState<'progress' | 'drawings' | 'settings'>('progress');
  const [pw, setPw] = useState('');
  if (fam.loading && !fam.data) return <Spinner />;
  if (fam.error && !fam.data) return <ErrorState error={fam.error} onRetry={fam.reload} />;
  const child = fam.data!.children.find((c) => c.id === id);
  if (!child) return <ErrorState error={new Error(t('Child not found.'))} />;

  const resetPw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/family/children/${child.id}/password`, { password: pw });
      setPw('');
      toast(t('Password changed'));
    } catch (er) {
      toast((er as Error).message, 'error');
    }
  };
  const remove = async () => {
    if (!confirm(t('Remove {name} and delete all their drawings forever?', { name: child.name }))) return;
    await api.del(`/api/family/children/${child.id}`);
    toast(t('Account removed'));
    nav('/parent', { replace: true });
  };

  return (
    <div className="screen with-nav" style={{ gap: 16 }}>
      <div className="row">
        <BackButton to="/parent" />
        <div className="col grow" style={{ gap: 0 }}>
          <h1 className="h1" style={{ fontSize: 22 }}>{child.name}</h1>
          <span className="small muted latin">@{child.username}</span>
        </div>
      </div>
      <Segmented
        label={t('Section')}
        value={tab}
        onChange={setTab}
        options={[
          { id: 'progress', label: t('Progress') },
          { id: 'drawings', label: t('Drawings') },
          { id: 'settings', label: t('Settings') },
        ]}
      />
      {tab === 'progress' && <ProgressView userId={child.id} header={false} />}
      {tab === 'drawings' &&
        (drawings.data?.drawings.length ? (
          <div className="grid-3">
            {drawings.data.drawings.map((d) => (
              <DrawingThumb key={d.id} d={d} to={`/parent/drawings/${d.id}`} />
            ))}
          </div>
        ) : (
          <p className="muted center">{t('No drawings yet')}</p>
        ))}
      {tab === 'settings' && (
        <>
          <ChildSettings child={child} onChange={() => fam.reload()} />
          <form className="card col" style={{ gap: 10 }} onSubmit={resetPw}>
            <span className="h3">{t('Set a new password for {name}', { name: child.name })}</span>
            <input className="input latin" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required placeholder={t('New password')} aria-label={t('New password')} />
            <button className="btn sm outline" style={{ alignSelf: 'flex-start' }}>{t('Save')}</button>
          </form>
          <button className="btn danger block" onClick={remove}>
            <Icon name="trash" size={18} /> {t('Remove child account')}
          </button>
        </>
      )}
    </div>
  );
}
