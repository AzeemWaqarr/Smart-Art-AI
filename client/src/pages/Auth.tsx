import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { useT } from '../i18n';
import { BackButton, Field, useAction } from '../components/ui';
import { InstallButton } from '../components/Shell';
import type { User } from '../types';

function HeroDrawing() {
  return (
    <svg width="100%" viewBox="0 0 300 220" role="img" aria-label="A child's drawing of a house, a tree and a sun" style={{ display: 'block', borderRadius: 8 }}>
      <rect width="300" height="220" fill="#FFFDF6" />
      <rect width="300" height="150" fill="#F7B267" />
      <circle cx="240" cy="48" r="24" fill="#F4B942" />
      <path d="M240 12v10M240 74v10M204 48h10M266 48h10M215 23l7 7M258 66l7 7M215 73l7-7M258 30l7-7" stroke="#E09A1E" strokeWidth="4" strokeLinecap="round" />
      <path d="M0 150 C60 140 120 158 180 146 C230 136 270 150 300 144 L300 220 L0 220 Z" fill="#7BB662" />
      <rect x="70" y="95" width="100" height="80" fill="#E86A5A" />
      <rect x="148" y="95" width="22" height="80" fill="#1D2B2E" opacity="0.22" />
      <path d="M58 97 L120 50 L182 97 Z" fill="#9B4636" />
      <rect x="108" y="135" width="24" height="40" fill="#6B4A2E" />
      <rect x="82" y="110" width="20" height="20" fill="#CFE3EC" stroke="#1D2B2E" strokeWidth="2" />
      <ellipse cx="190" cy="178" rx="36" ry="6" fill="#1D2B2E" opacity="0.15" />
      <rect x="216" y="120" width="10" height="55" fill="#7A5230" />
      <circle cx="221" cy="110" r="26" fill="#4E9A4A" />
    </svg>
  );
}

export function Welcome() {
  const { t } = useT();
  const nav = useNavigate();
  const [age, setAge] = useState<'teen' | 'kid'>('teen');
  return (
    <div className="screen">
      <section className="challenge" style={{ paddingBottom: 18 }}>
        <div className="blob" />
        <div className="blob2" />
        <div className="k">{t('Smart Art coach')}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10 }}>
          <div style={{ width: 170, padding: 7, borderRadius: 12, background: '#fff', transform: 'rotate(-4deg)', flex: 'none' }}>
            <HeroDrawing />
          </div>
          <div style={{ background: 'var(--paper)', color: 'var(--ink)', borderRadius: '14px 14px 14px 4px', padding: '9px 11px', fontSize: 13, fontWeight: 700, lineHeight: 1.35, boxShadow: '0 8px 24px #0003' }}>
            {t('Great composition! Try a warm orange sky to match the sun.')}
          </div>
        </div>
      </section>

      <div>
        <h2 style={{ fontSize: 28 }}>
          {t('Your personal')} <span style={{ color: 'var(--coral)' }}>{t('AI art coach')}</span>
        </h2>
        <p className="muted" style={{ marginTop: 4 }}>{t('Snap your drawing. Get kind, clear tips on colour, light, proportion and composition.')}</p>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span id="age-label" className="label">{t('How old are you?')}</span>
        <div role="group" aria-labelledby="age-label" className="grid-2">
          {[
            { id: 'teen' as const, label: t('13 or older'), sub: t('Make my account') },
            { id: 'kid' as const, label: t('Under 13'), sub: t('A parent sets it up') },
          ].map((a) => (
            <button key={a.id} type="button" className="choice" aria-pressed={age === a.id} onClick={() => setAge(a.id)}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{a.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>{a.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn primary lg block" onClick={() => nav(age === 'kid' ? '/signup?as=parent' : '/signup')}>
        {age === 'kid' ? t('Ask a parent to set up') : t('Start drawing')}
        <span className="flip" style={{ display: 'inline-block' }} aria-hidden="true">→</span>
      </button>
      <div className="btns">
        <Link to="/login" className="btn ghost">{t('Log in')}</Link>
        <Link to="/signup?as=parent" className="btn ghost">{t("I'm a parent")}</Link>
      </div>
      <InstallButton className="btn link" />
      <div className="safe">{t('Safe for kids · No ads · No chat with strangers')}</div>
    </div>
  );
}

export function Login() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const { busy, error, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = await run(() => login(id.trim(), pw));
    if (u) nav(homeFor(u), { replace: true });
  };
  return (
    <form className="screen" onSubmit={submit}>
      <BackButton to="/welcome" />
      <div className="col" style={{ gap: 4, marginTop: 8 }}>
        <h2>{t('Welcome back!')}</h2>
        <p className="muted">{t('Log in with your email, or the username your parent made for you.')}</p>
      </div>
      <Field label={t('Email or username')} id="id">
        <input id="id" className="input latin" autoComplete="username" autoCapitalize="none" value={id} onChange={(e) => setId(e.target.value)} required />
      </Field>
      <Field label={t('Password')} id="pw">
        <input id="pw" className="input latin" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      {error && <div className="error-box">{error}</div>}
      <button className="btn primary lg block" disabled={busy}>
        {busy ? t('Logging in…') : t('Log in')}
      </button>
      <p className="center small muted">
        {t('New here?')} <Link to="/signup" className="bold">{t('Make an account')}</Link> · <Link to="/signup?as=parent" className="bold">{t('Parent sign up')}</Link>
      </p>
      <p className="center tiny muted">{t('Forgot your password? Children can ask their parent to reset it. Others can contact support.')}</p>
    </form>
  );
}

export function Signup() {
  const { t, lang } = useT();
  const [params] = useSearchParams();
  const asParent = params.get('as') === 'parent';
  const { refresh } = useAuth();
  const nav = useNavigate();
  const thisYear = new Date().getFullYear();
  const [f, setF] = useState({ name: '', email: '', password: '', birthYear: '', phone: '', agree: false });
  const { busy, error, run, setError } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const tooYoung = !asParent && f.birthYear && thisYear - Number(f.birthYear) < 13;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.agree) return setError(t('Please agree to the safety promises first.'));
    if (tooYoung) return;
    const r = await run(() =>
      api.post<{ user: User }>('/api/auth/signup', {
        role: asParent ? 'parent' : 'student',
        name: f.name,
        email: f.email,
        password: f.password,
        birthYear: asParent ? undefined : Number(f.birthYear),
        phone: f.phone || undefined,
        language: lang,
      }),
    );
    if (r) {
      await refresh();
      nav(asParent ? '/parent/children/new?first=1' : '/app', { replace: true });
    }
  };

  return (
    <form className="screen" onSubmit={submit}>
      <BackButton to="/welcome" />
      <div className="col" style={{ gap: 4 }}>
        {asParent && <span className="eyebrow">{t('Parent account')}</span>}
        <h2>{asParent ? t('Set up your family') : t('Make your account')}</h2>
        <p className="muted">{asParent ? t("Create your parent account first. Then add your child — they'll log in with a username, no email needed.") : t('For artists aged 13 and older.')}</p>
      </div>

      <Field label={asParent ? t('Your name') : t('First name')} id="name">
        <input id="name" className="input" autoComplete="given-name" value={f.name} onChange={set('name')} required maxLength={60} />
      </Field>
      <Field label={t('Email')} id="email">
        <input id="email" className="input latin" type="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={set('email')} required />
      </Field>
      <Field label={t('Password')} id="password" hint={t('At least 8 characters.')}>
        <input id="password" className="input latin" type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set('password')} required />
      </Field>
      {!asParent && (
        <Field label={t('Birth year')} id="by">
          <select id="by" className="input latin" value={f.birthYear} onChange={set('birthYear')} required>
            <option value="">{t('Choose…')}</option>
            {Array.from({ length: 70 }, (_, i) => thisYear - 5 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
      )}
      {asParent && (
        <Field label={t('Mobile number (optional)')} id="phone" hint={t('For the weekly progress report.')}>
          <input id="phone" className="input latin" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="03xx-xxxxxxx" />
        </Field>
      )}

      {tooYoung && (
        <div className="info-box">
          {t('Under 13? A parent needs to set up your account.')} <Link to="/signup?as=parent">{t('Parent sign up')}</Link>
        </div>
      )}

      <label className="row card tight" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.agree} onChange={set('agree')} style={{ width: 22, height: 22, marginTop: 2, accentColor: 'var(--primary)' }} />
        <span className="small">
          {t('I understand: drawings stay private, there is no public feed or chat, and the AI never draws for me.')}
        </span>
      </label>

      {error && <div className="error-box">{error}</div>}
      <button className="btn primary lg block" disabled={busy || !!tooYoung}>
        {busy ? t('Creating…') : asParent ? t('Create family account') : t('Start drawing')}
      </button>
      <p className="center small muted">
        {t('Already have an account?')} <Link to="/login" className="bold">{t('Log in')}</Link>
      </p>
    </form>
  );
}
