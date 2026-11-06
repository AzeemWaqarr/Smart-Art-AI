import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { ErrorState, Field, Spinner, useAction, useFetch, useToast } from '../components/ui';
import type { Scores, User } from '../types';

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const age = (y: number | null) => (y ? new Date().getFullYear() - y : null);

function Loading<T>({ q, children }: { q: { data: T | null; error: Error | null; loading: boolean; reload: () => void }; children: (d: T) => JSX.Element }) {
  if (q.loading && !q.data) return <Spinner />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  return q.data ? children(q.data) : null;
}

// ------------------------------------------------------------------ dashboard
type Stats = {
  users: { students: number; parents: number; admins: number; plus: number; active7: number };
  drawings: { week: number; total: number; failed: number; processing: number };
  daily: { signups: { day: string; count: number }[]; drawings: { day: string; count: number }[] };
  ai: { real: boolean; provider: string; model: string; baseUrl: string | null };
};

function Bars({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="between">
        <span className="h3">{label}</span>
        <span className="small muted">Last 14 days · {data.reduce((a, b) => a + b.count, 0)} total</span>
      </div>
      <div className="bars" role="img" aria-label={`${label}: ${data.map((d) => d.count).join(', ')}`}>
        {data.map((d, i) => (
          <div key={d.day} title={`${d.day}: ${d.count}`}>
            <span className="tiny bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.count || ''}</span>
            <span className={`bar ${i === data.length - 1 ? 'hi' : ''}`} style={{ height: `${(d.count / max) * 90}%` }} />
            <span className="tiny muted" style={{ fontSize: 10 }}>{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const q = useFetch<Stats>('/api/admin/stats');
  return (
    <Loading q={q}>
      {(s) => (
        <>
          <div className="between">
            <h1>Dashboard</h1>
            <span className={`tag ${s.ai.real ? 'good' : 'gold'}`}>{s.ai.real ? `AI: ${s.ai.model}` : 'AI: demo coach'}</span>
          </div>
          {s.drawings.failed > 0 && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {s.drawings.failed > 0 && <Link to="/admin/ai" className="btn sm danger">{s.drawings.failed} failed analysis</Link>}
            </div>
          )}
          <div className="stat-grid">
            <div className="stat"><span className="k">Students</span><span className="v">{s.users.students}</span><span className="tiny muted">{s.users.active7} active in 7 days</span></div>
            <div className="stat"><span className="k">Parents</span><span className="v">{s.users.parents}</span></div>
            <div className="stat"><span className="k">Drawings this week</span><span className="v">{s.drawings.week}</span><span className="tiny muted">{s.drawings.total} all time</span></div>
            <div className="stat"><span className="k">In the AI queue</span><span className="v">{s.drawings.processing}</span><span className="tiny muted">{s.drawings.failed} failed</span></div>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Bars data={s.daily.signups} label="New accounts" />
            <Bars data={s.daily.drawings} label="Drawings snapped" />
          </div>
        </>
      )}
    </Loading>
  );
}

// ------------------------------------------------------------------ users
type UserRow = User & { drawings: number; children: number; parent: { id: string; name: string } | null; lastActiveAt: string | null };

export function AdminUsers() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const url = `/api/admin/users?q=${encodeURIComponent(q)}&role=${role}&page=${page}`;
  const data = useFetch<{ users: UserRow[]; total: number; pages: number }>(url);
  return (
    <>
      <div className="between">
        <h1>Users</h1>
        <button className="btn sm" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New user</button>
      </div>
      {creating && <CreateUser onDone={() => (setCreating(false), data.reload())} onCancel={() => setCreating(false)} />}
      <div className="toolbar">
        <input className="input" placeholder="Search name, email or username" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} style={{ minWidth: 260 }} />
        <select className="input" value={role} onChange={(e) => (setRole(e.target.value), setPage(1))}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="parent">Parents</option>
          <option value="admin">Admins</option>
        </select>
        {data.data && <span className="small muted">{data.data.total} users</span>}
      </div>
      <Loading q={data}>
        {(d) => (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Login</th><th>Drawings</th><th>Last active</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {d.users.map((u) => (
                    <tr key={u.id} className="clickable" onClick={() => nav(`/admin/users/${u.id}`)}>
                      <td><b>{u.name}</b>{u.role === 'student' && age(u.birthYear) !== null && <span className="muted"> · {age(u.birthYear)}y</span>}{u.parent && <div className="tiny muted">child of {u.parent.name}</div>}{u.role === 'parent' && u.children > 0 && <div className="tiny muted">{u.children} child(ren)</div>}</td>
                      <td><span className={`tag ${u.role === 'admin' ? 'purple' : u.role === 'parent' ? 'blue' : 'grey'}`}>{u.role}</span></td>
                      <td className="small">{u.email || (u.username ? `@${u.username}` : '—')}</td>
                      <td>{u.drawings}</td>
                      <td className="small">{fmtDate(u.lastActiveAt)}</td>
                      <td>{u.status === 'active' ? <span className="tag good">active</span> : <span className="tag try">suspended</span>}</td>
                    </tr>
                  ))}
                  {d.users.length === 0 && <tr><td colSpan={7} className="center muted">No users match.</td></tr>}
                </tbody>
              </table>
            </div>
            {d.pages > 1 && (
              <div className="row">
                <button className="btn sm light" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="small">Page {page} of {d.pages}</span>
                <button className="btn sm light" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

function CreateUser({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ role: 'admin', name: '', email: '', password: '', birthYear: '' });
  const { busy, error, run } = useAction();
  const toast = useToast();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.post('/api/admin/users', { ...f, birthYear: f.birthYear ? Number(f.birthYear) : undefined }));
    if (r) {
      toast('User created');
      onDone();
    }
  };
  return (
    <form className="card col" onSubmit={submit} style={{ gap: 12 }}>
      <span className="h3">New user</span>
      <div className="form-grid">
        <Field label="Role" id="r"><select id="r" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">Admin</option><option value="parent">Parent</option><option value="student">Student (13+)</option></select></Field>
        <Field label="Name" id="n"><input id="n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Email" id="e"><input id="e" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Temporary password" id="p"><input id="p" className="input" value={f.password} minLength={8} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        {f.role === 'student' && <Field label="Birth year" id="b"><input id="b" className="input" type="number" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })} required /></Field>}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="row"><button className="btn sm" disabled={busy}>Create</button><button type="button" className="btn sm light" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

type UserDetailData = {
  user: User & { lastActiveAt: string | null };
  parent: User | null;
  children: User[];
  badges: string[];
  stats: { drawings: number; practices: number; minutes: number; streak: number; skills: { scores: Scores; basedOn: number } } | null;
  drawings: { id: string; title: string; status: string; error: string | null; provider: string | null; scores: Scores | null; createdAt: string; durationMs: number | null }[];
};

export function AdminUserDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const q = useFetch<UserDetailData>(`/api/admin/users/${id}`, [id]);
  const [pw, setPw] = useState('');

  const patch = async (body: Record<string, unknown>, msg = 'Saved') => {
    try {
      await api.patch(`/api/admin/users/${id}`, body);
      toast(msg);
      q.reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Loading q={q}>
      {(d) => {
        const u = d.user;
        return (
          <>
            <div className="row">
              <Link to="/admin/users" className="icon-btn" aria-label="Back"><Icon name="back" size={20} /></Link>
              <div className="col grow" style={{ gap: 0 }}>
                <h1>{u.name}</h1>
                <span className="small muted">{u.role} · {u.email || `@${u.username}`} · joined {fmtDate(u.createdAt)} · last active {fmtDateTime(u.lastActiveAt)}</span>
              </div>
              {u.status === 'active' ? <span className="tag good">active</span> : <span className="tag try">suspended</span>}
            </div>

            <div className="grid-2" style={{ gap: 14, alignItems: 'start' }}>
              <div className="card col" style={{ gap: 12 }}>
                <span className="h3">Account</span>
                <div className="small col" style={{ gap: 4 }}>
                  {u.role === 'student' && <span>Age: <b>{age(u.birthYear) ?? '—'}</b></span>}
                  <span>Language: <b>{u.language === 'ur' ? 'Urdu' : 'English'}</b></span>
                  {u.phone && <span>Phone: <b>{u.phone}</b></span>}
                  {d.parent && <span>Parent: <Link to={`/admin/users/${d.parent.id}`}>{d.parent.name}</Link> ({d.parent.email})</span>}
                  {d.children.length > 0 && <span>Children: {d.children.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link to={`/admin/users/${c.id}`}>{c.name}</Link></span>)}</span>}
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {u.status === 'active' ? (
                    <button className="btn sm danger" onClick={() => confirm(`Suspend ${u.name}? They will be logged out.`) && patch({ status: 'suspended' }, 'User suspended')}>Suspend</button>
                  ) : (
                    <button className="btn sm" onClick={() => patch({ status: 'active' }, 'User re-activated')}>Re-activate</button>
                  )}
                  <button
                    className="btn sm danger"
                    onClick={async () => {
                      if (!confirm(`Delete ${u.name}${d.children.length ? ` and ${d.children.length} child account(s)` : ''} permanently, including all drawings?`)) return;
                      await api.del(`/api/admin/users/${u.id}`).then(() => (toast('User deleted'), nav('/admin/users'))).catch((e) => toast(e.message, 'error'));
                    }}
                  >
                    Delete
                  </button>
                </div>
                <form className="row" onSubmit={async (e) => {
                  e.preventDefault();
                  try { await api.post(`/api/admin/users/${u.id}/password`, { password: pw }); setPw(''); toast('Password reset'); } catch (er) { toast((er as Error).message, 'error'); }
                }}>
                  <input className="input" style={{ minHeight: 42 }} placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
                  <button className="btn sm outline">Reset password</button>
                </form>
              </div>

              {u.role === 'student' && (
                <div className="card col" style={{ gap: 12 }}>
                  <span className="h3">Activity</span>
                  {d.stats && (
                    <div className="small col" style={{ gap: 4 }}>
                      <span>This week: <b>{d.stats.drawings}</b> drawings, <b>{d.stats.minutes}</b> minutes · streak <b>{d.stats.streak}</b> days · <b>{d.stats.practices}</b> practice sessions</span>
                      <span>Skills: {(['colour', 'light', 'proportion', 'composition'] as const).map((k) => `${k} ${d.stats!.skills.scores[k]}`).join(' · ')}</span>
                      <span>Badges: {d.badges.length ? d.badges.join(', ') : 'none yet'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {u.role === 'student' && (
              <div className="col">
                <span className="h3">Drawings</span>
                <p className="tiny muted">Photos stay private to the family. Admins only see feedback data.</p>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Title</th><th>When</th><th>Status</th><th>Coach</th><th>Scores (C/L/P/Comp)</th><th>Time</th></tr></thead>
                    <tbody>
                      {d.drawings.map((x) => (
                        <tr key={x.id}>
                          <td>{x.title}</td>
                          <td className="small">{fmtDateTime(x.createdAt)}</td>
                          <td><span className={`tag ${x.status === 'done' ? 'good' : x.status === 'processing' ? 'blue' : 'try'}`}>{x.status}</span>{x.error && <div className="tiny muted" style={{ maxWidth: 280 }}>{x.error}</div>}</td>
                          <td className="small">{x.provider || '—'}</td>
                          <td className="small">{x.scores ? `${x.scores.colour} / ${x.scores.light} / ${x.scores.proportion} / ${x.scores.composition}` : '—'}</td>
                          <td className="small">{x.durationMs ? `${(x.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                      {d.drawings.length === 0 && <tr><td colSpan={6} className="muted center">No drawings yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      }}
    </Loading>
  );
}

// ------------------------------------------------------------------ settings & audit
type SettingsT = { autoDailyChallenge: number; supportContact: string };

export function AdminSettings() {
  const toast = useToast();
  const q = useFetch<{ settings: SettingsT }>('/api/admin/settings');
  const [f, setF] = useState<SettingsT | null>(null);
  const cur = f || q.data?.settings || null;
  const [b, setB] = useState({ audience: 'students', title: '', body: '', link: '' });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.put<{ settings: SettingsT }>('/api/admin/settings', cur);
      setF(r.settings);
      toast('Settings saved');
    } catch (er) {
      toast((er as Error).message, 'error');
    }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm(`Send this notification to all ${b.audience}?`)) return;
    try {
      const r = await api.post<{ sent: number }>('/api/admin/broadcast', { ...b, link: b.link || undefined });
      toast(`Sent to ${r.sent} people`);
      setB({ ...b, title: '', body: '' });
    } catch (er) {
      toast((er as Error).message, 'error');
    }
  };
  if (q.loading && !cur) return <Spinner />;
  if (!cur) return <ErrorState error={q.error} onRetry={q.reload} />;
  return (
    <>
      <h1>Settings</h1>
      <form className="card col" style={{ gap: 14 }} onSubmit={save}>
        <span className="h3">App settings</span>
        <label className="row small bold" style={{ gap: 8 }}>
          <input type="checkbox" checked={cur.autoDailyChallenge === 1} onChange={(e) => setF({ ...cur, autoDailyChallenge: e.target.checked ? 1 : 0 })} />
          Create a "Today's challenge" automatically every day
        </label>
        <Field label="Support contact" id="s8"><input id="s8" className="input" value={cur.supportContact} onChange={(e) => setF({ ...cur, supportContact: e.target.value })} /></Field>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }}>Save settings</button>
      </form>

      <form className="card col" style={{ gap: 12 }} onSubmit={send}>
        <span className="h3">Send an announcement</span>
        <p className="small muted">Appears in the app's notifications (e.g. a new challenge).</p>
        <div className="form-grid">
          <Field label="Audience" id="b1"><select id="b1" className="input" value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })}><option value="students">Students</option><option value="parents">Parents</option><option value="all">Everyone</option></select></Field>
          <Field label="Title" id="b2"><input id="b2" className="input" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} required maxLength={80} /></Field>
          <Field label="Link (optional)" id="b4"><input id="b4" className="input" placeholder="/app/lessons" value={b.link} onChange={(e) => setB({ ...b, link: e.target.value })} /></Field>
        </div>
        <Field label="Message" id="b3"><textarea id="b3" className="input" value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} required maxLength={300} /></Field>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }}><Icon name="megaphone" size={18} /> Send</button>
      </form>
    </>
  );
}

export function AdminAudit() {
  const q = useFetch<{ logs: { id: string; action: string; target: string | null; details: unknown; createdAt: string; actor: { name: string; role: string } | null }[] }>('/api/admin/audit');
  return (
    <>
      <h1>Audit log</h1>
      <Loading q={q}>
        {(d) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
              <tbody>
                {d.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.createdAt)}</td>
                    <td className="small">{l.actor ? `${l.actor.name} (${l.actor.role})` : 'system'}</td>
                    <td><code>{l.action}</code></td>
                    <td className="tiny muted">{l.target}</td>
                    <td className="tiny" style={{ maxWidth: 360, wordBreak: 'break-word' }}>{l.details ? JSON.stringify(l.details) : ''}</td>
                  </tr>
                ))}
                {d.logs.length === 0 && <tr><td colSpan={5} className="muted center">No activity yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Loading>
    </>
  );
}
