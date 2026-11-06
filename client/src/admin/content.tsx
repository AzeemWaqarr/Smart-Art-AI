import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { categoryLabel } from '../components/Art';
import { LessonTile } from '../components/Coach';
import { ErrorState, Field, Spinner, useAction, useFetch, useToast } from '../components/ui';
import type { Lesson } from '../types';

// ------------------------------------------------------------------ lessons
type AdminLesson = Omit<Lesson, 'completed' | 'stepCount'> & { published: boolean; sortOrder: number; sessions: number };
const CATS: Lesson['category'][] = ['light', 'colour', 'proportion', 'composition', 'perspective', 'shapes'];
const blankLesson = (): Omit<AdminLesson, 'id' | 'sessions'> => ({
  slug: '', title: '', titleUr: '', category: 'light', summary: '', summaryUr: '', durationMin: 5, steps: [{ en: '', ur: '' }], published: true, sortOrder: 0,
});

function LessonEditor({ initial, onSaved, onCancel }: { initial: Omit<AdminLesson, 'sessions'> | (Omit<AdminLesson, 'id' | 'sessions'> & { id?: string }); onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  const { busy, error, run } = useAction();
  const toast = useToast();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, titleUr: f.titleUr || null, summaryUr: f.summaryUr || null, steps: f.steps.filter((s) => s.en.trim()).map((s) => ({ en: s.en, ur: s.ur || undefined })) };
    delete (body as { id?: string }).id;
    const r = await run(() => ('id' in f && f.id ? api.put(`/api/admin/lessons/${f.id}`, body) : api.post('/api/admin/lessons', body)));
    if (r) {
      toast('Lesson saved');
      onSaved();
    }
  };
  return (
    <form className="card col" style={{ gap: 14 }} onSubmit={submit}>
      <span className="h3">{'id' in f && f.id ? 'Edit lesson' : 'New lesson'}</span>
      <div className="form-grid">
        <Field label="Title (English)" id="lt"><input id="lt" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: 'id' in f && f.id ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /></Field>
        <Field label="Title (Urdu)" id="ltu"><input id="ltu" className="input ur" value={f.titleUr || ''} onChange={(e) => set('titleUr', e.target.value)} /></Field>
        <Field label="URL slug" id="ls" hint="lowercase-with-dashes"><input id="ls" className="input" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} required placeholder={f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')} /></Field>
        <Field label="Category" id="lc"><select id="lc" className="input" value={f.category} onChange={(e) => set('category', e.target.value as Lesson['category'])}>{CATS.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></Field>
        <Field label="Minutes" id="lm"><input id="lm" className="input" type="number" min={1} max={120} value={f.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} /></Field>
        <Field label="Order" id="lo"><input id="lo" className="input" type="number" value={f.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></Field>
      </div>
      <Field label="Summary (English)" id="lsu"><input id="lsu" className="input" value={f.summary} onChange={(e) => set('summary', e.target.value)} required maxLength={200} /></Field>
      <Field label="Summary (Urdu)" id="lsuu"><input id="lsuu" className="input ur" value={f.summaryUr || ''} onChange={(e) => set('summaryUr', e.target.value)} maxLength={300} /></Field>
      <div className="col" style={{ gap: 8 }}>
        <span className="label">Steps</span>
        {f.steps.map((s, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
            <span className="badge-num" style={{ marginTop: 10 }}>{i + 1}</span>
            <div className="col grow" style={{ gap: 6 }}>
              <input className="input" placeholder="Step in English" value={s.en} onChange={(e) => set('steps', f.steps.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} required={i === 0} maxLength={200} />
              <input className="input ur" placeholder="اردو میں قدم" value={s.ur || ''} onChange={(e) => set('steps', f.steps.map((x, j) => (j === i ? { ...x, ur: e.target.value } : x)))} maxLength={300} />
            </div>
            <button type="button" className="icon-btn" aria-label="Remove step" onClick={() => set('steps', f.steps.filter((_, j) => j !== i))} disabled={f.steps.length === 1}><Icon name="trash" size={18} /></button>
          </div>
        ))}
        {f.steps.length < 12 && <button type="button" className="btn sm light" style={{ alignSelf: 'flex-start' }} onClick={() => set('steps', [...f.steps, { en: '', ur: '' }])}><Icon name="plus" size={16} /> Add step</button>}
      </div>
      <div className="row" style={{ gap: 18 }}>
        <label className="row small bold" style={{ gap: 6 }}><input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} /> Published</label>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="row"><button className="btn sm" disabled={busy}>Save lesson</button><button type="button" className="btn sm light" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function AdminLessons() {
  const toast = useToast();
  const q = useFetch<{ lessons: AdminLesson[] }>('/api/admin/lessons');
  const [editing, setEditing] = useState<AdminLesson | 'new' | null>(null);
  if (q.loading && !q.data) return <Spinner />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  const done = () => (setEditing(null), q.reload());
  return (
    <>
      <div className="between">
        <h1>Lessons</h1>
        {!editing && <button className="btn sm" onClick={() => setEditing('new')}><Icon name="plus" size={18} /> New lesson</button>}
      </div>
      {editing && <LessonEditor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? { ...blankLesson(), sortOrder: q.data!.lessons.length } : editing} onSaved={done} onCancel={() => setEditing(null)} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th></th><th>Lesson</th><th>Category</th><th>Steps</th><th>Status</th><th>Sessions</th><th></th></tr></thead>
          <tbody>
            {q.data!.lessons.map((l) => (
              <tr key={l.id}>
                <td style={{ width: 56 }}><div className="lesson" style={{ padding: 0, background: 'none' }}><LessonTile category={l.category} size={40} /></div></td>
                <td><b>{l.title}</b>{l.titleUr && <div className="tiny muted ur" style={{ lineHeight: 1.8 }}>{l.titleUr}</div>}<div className="tiny muted">/{l.slug} · {l.durationMin} min</div></td>
                <td className="small">{categoryLabel(l.category)}</td>
                <td>{l.steps.length}</td>
                <td>{l.published ? <span className="tag good">published</span> : <span className="tag grey">draft</span>}</td>
                <td>{l.sessions}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm light" onClick={() => setEditing(l)}>Edit</button>{' '}
                  <button className="btn sm danger" onClick={async () => {
                    if (!confirm(`Delete "${l.title}"? Practice history for it will also be removed.`)) return;
                    await api.del(`/api/admin/lessons/${l.id}`).then(() => (toast('Lesson deleted'), q.reload())).catch((e) => toast(e.message, 'error'));
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ challenges
type AdminChallenge = { id: string; title: string; titleUr: string | null; description: string; descriptionUr: string | null; prize: string | null; startsAt: string; endsAt: string; active: boolean; joined: number; submitted: number };
const toInput = (iso: string) => iso.slice(0, 10);

function ChallengeEditor({ initial, onSaved, onCancel }: { initial: Partial<AdminChallenge>; onSaved: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    title: initial.title || '', titleUr: initial.titleUr || '', description: initial.description || '', descriptionUr: initial.descriptionUr || '', prize: initial.prize || '',
    startsAt: initial.startsAt ? toInput(initial.startsAt) : today, endsAt: initial.endsAt ? toInput(initial.endsAt) : today, active: initial.active ?? true,
  });
  const { busy, error, run } = useAction();
  const toast = useToast();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, titleUr: f.titleUr || null, descriptionUr: f.descriptionUr || null, prize: f.prize || null, startsAt: new Date(f.startsAt + 'T00:00:00').toISOString(), endsAt: new Date(f.endsAt + 'T23:59:59').toISOString() };
    const r = await run(() => (initial.id ? api.put(`/api/admin/challenges/${initial.id}`, body) : api.post('/api/admin/challenges', body)));
    if (r) {
      toast('Challenge saved');
      onSaved();
    }
  };
  return (
    <form className="card col" style={{ gap: 14 }} onSubmit={submit}>
      <span className="h3">{initial.id ? 'Edit challenge' : 'New challenge'}</span>
      <div className="form-grid">
        <Field label="Title (English)" id="ct"><input id="ct" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
        <Field label="Title (Urdu)" id="ctu"><input id="ctu" className="input ur" value={f.titleUr} onChange={(e) => setF({ ...f, titleUr: e.target.value })} /></Field>
        <Field label="Starts" id="cs"><input id="cs" className="input" type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} required /></Field>
        <Field label="Ends" id="ce"><input id="ce" className="input" type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} required /></Field>
        <Field label="Prize" id="cp"><input id="cp" className="input" value={f.prize} onChange={(e) => setF({ ...f, prize: e.target.value })} /></Field>
      </div>
      <Field label="Description (English)" id="cd"><textarea id="cd" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required maxLength={400} /></Field>
      <Field label="Description (Urdu)" id="cdu"><textarea id="cdu" className="input ur" value={f.descriptionUr} onChange={(e) => setF({ ...f, descriptionUr: e.target.value })} maxLength={600} /></Field>
      <label className="row small bold" style={{ gap: 6 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      {error && <div className="error-box">{error}</div>}
      <div className="row"><button className="btn sm" disabled={busy}>Save</button><button type="button" className="btn sm light" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function AdminChallenges() {
  const toast = useToast();
  const q = useFetch<{ challenges: AdminChallenge[] }>('/api/admin/challenges');
  const [editing, setEditing] = useState<Partial<AdminChallenge> | null>(null);
  if (q.loading && !q.data) return <Spinner />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  const now = Date.now();
  return (
    <>
      <div className="between">
        <h1>Monthly challenges</h1>
        {!editing && <button className="btn sm" onClick={() => setEditing({})}><Icon name="plus" size={18} /> New challenge</button>}
      </div>
      {editing && <ChallengeEditor key={editing.id || 'new'} initial={editing} onSaved={() => (setEditing(null), q.reload())} onCancel={() => setEditing(null)} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Challenge</th><th>Dates</th><th>Status</th><th>Joined</th><th>Entries</th><th></th></tr></thead>
          <tbody>
            {q.data!.challenges.map((c) => {
              const live = c.active && new Date(c.startsAt).getTime() <= now && new Date(c.endsAt).getTime() >= now;
              return (
                <tr key={c.id}>
                  <td><b>{c.title}</b><div className="tiny muted">{c.prize}</div></td>
                  <td className="small">{new Date(c.startsAt).toLocaleDateString()} – {new Date(c.endsAt).toLocaleDateString()}</td>
                  <td>{live ? <span className="tag good">live</span> : c.active ? <span className="tag blue">{new Date(c.startsAt).getTime() > now ? 'scheduled' : 'ended'}</span> : <span className="tag grey">off</span>}</td>
                  <td>{c.joined}</td>
                  <td>{c.submitted}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm light" onClick={() => setEditing(c)}>Edit</button>{' '}
                    <button className="btn sm danger" onClick={async () => {
                      if (!confirm(`Delete "${c.title}" and its entries?`)) return;
                      await api.del(`/api/admin/challenges/${c.id}`).then(() => (toast('Deleted'), q.reload())).catch((e) => toast(e.message, 'error'));
                    }}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {q.data!.challenges.length === 0 && <tr><td colSpan={6} className="muted center">No challenges yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ AI monitor
type AiDrawing = { id: string; title: string; status: string; error: string | null; provider: string | null; model: string | null; durationMs: number | null; createdAt: string; user: { id: string; name: string } };

export function AdminAi() {
  const toast = useToast();
  const stats = useFetch<{ ai: { real: boolean; provider: string; model: string; baseUrl: string | null }; drawings: { processing: number; failed: number } }>('/api/admin/stats');
  const [status, setStatus] = useState('');
  const q = useFetch<{ drawings: AiDrawing[] }>(`/api/admin/drawings${status ? `?status=${status}` : ''}`);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const testAct = useAction();
  const ai = stats.data?.ai;
  const done = q.data?.drawings.filter((d) => d.status === 'done' && d.durationMs) || [];
  const avg = done.length ? done.reduce((a, d) => a + (d.durationMs || 0), 0) / done.length / 1000 : 0;
  return (
    <>
      <h1>AI coach</h1>
      <div className="card col" style={{ gap: 10 }}>
        <div className="between">
          <span className="h3">Model connection</span>
          {ai && <span className={`tag ${ai.real ? 'good' : 'gold'}`}>{ai.real ? 'Your model' : 'Demo coach'}</span>}
        </div>
        {ai && (
          <div className="small col" style={{ gap: 2 }}>
            <span>Provider: <b>{ai.real ? 'OpenAI-compatible endpoint' : 'built-in demo (no model configured)'}</b></span>
            {ai.real && <span>Endpoint: <code>{ai.baseUrl}</code></span>}
            <span>Model: <code>{ai.model}</code></span>
            <span className="muted">Change these in <code>server/.env</code> (AI_BASE_URL, AI_MODEL, AI_API_KEY) and restart the server.</span>
          </div>
        )}
        <div className="row">
          <button className="btn sm" disabled={testAct.busy} onClick={() => testAct.run(async () => setTest(await api.post('/api/admin/ai/test')))}>
            {testAct.busy ? 'Testing…' : 'Test connection'}
          </button>
          {test && <span className={test.ok ? 'tag good' : 'tag try'} style={{ whiteSpace: 'normal' }}>{test.message}</span>}
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat"><span className="k">In queue</span><span className="v">{stats.data?.drawings.processing ?? '–'}</span></div>
        <div className="stat"><span className="k">Failed</span><span className="v">{stats.data?.drawings.failed ?? '–'}</span></div>
        <div className="stat"><span className="k">Avg. analysis time (recent)</span><span className="v">{avg ? `${avg.toFixed(1)}s` : '–'}</span></div>
      </div>
      <div className="toolbar">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All recent</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="rejected">Not a drawing</option>
          <option value="done">Done</option>
        </select>
        <button className="btn sm light" onClick={() => (q.reload(), stats.reload())}><Icon name="refresh" size={16} /> Refresh</button>
      </div>
      {q.loading && !q.data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Student</th><th>Title</th><th>Status</th><th>Model</th><th>Time</th><th></th></tr></thead>
            <tbody>
              {q.data?.drawings.map((d) => (
                <tr key={d.id}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(d.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="small">{d.user.name}</td>
                  <td>{d.title}</td>
                  <td><span className={`tag ${d.status === 'done' ? 'good' : d.status === 'processing' ? 'blue' : 'try'}`}>{d.status}</span>{d.error && <div className="tiny muted" style={{ maxWidth: 320, wordBreak: 'break-word' }}>{d.error}</div>}</td>
                  <td className="tiny">{d.model || d.provider || '—'}</td>
                  <td className="small">{d.durationMs ? `${(d.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td>{(d.status === 'failed' || d.status === 'rejected') && <button className="btn sm light" onClick={async () => { await api.post(`/api/admin/drawings/${d.id}/retry`).catch((e) => toast(e.message, 'error')); toast('Re-queued'); q.reload(); }}>Retry</button>}</td>
                </tr>
              ))}
              {q.data?.drawings.length === 0 && <tr><td colSpan={7} className="muted center">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
