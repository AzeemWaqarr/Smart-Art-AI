import { useState } from 'react';
import { useT } from '../i18n';
import { BadgeMedal } from '../components/Art';
import { ScoreDots, toFive } from '../components/Coach';
import { ErrorState, Segmented, SKILL_LABEL, skillWord, Spinner, useFetch } from '../components/ui';
import type { Badge, Drawing, Scores } from '../types';

type ProgressData = {
  name: string;
  totalDrawings: number;
  practices: number;
  streak: number;
  weeksActive: number;
  weeks: { start: string; count: number }[];
  skills: { scores: Scores; basedOn: number };
  badges: Badge[];
  beforeAfter: { before: Drawing; after: Drawing } | null;
};

function delta(b: Scores | null, a: Scores | null) {
  if (!a || !b) return null;
  const keys = ['colour', 'light', 'proportion', 'composition'] as const;
  const best = [...keys].sort((x, y) => a[y] - b[y] - (a[x] - b[x]))[0];
  return { skill: best, by: a[best] - b[best] };
}

/** Progress view. Pass `userId` when a parent looks at a child. */
export function ProgressView({ userId, header = true }: { userId?: string; header?: boolean }) {
  const { t, ur } = useT();
  const { data, error, loading, reload } = useFetch<ProgressData>(`/api/progress${userId ? `?userId=${userId}` : ''}`, [userId]);
  const [view, setView] = useState<'before' | 'after'>('after');
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const p = data!;
  const max = Math.max(1, ...p.weeks.map((w) => w.count));
  const d = delta(p.beforeAfter?.before.scores ?? null, p.beforeAfter?.after.scores ?? null);
  const shown = p.beforeAfter ? (view === 'after' ? p.beforeAfter.after : p.beforeAfter.before) : null;

  return (
    <>
      {header && (
        <div className="col" style={{ gap: 2 }}>
          <h2>{userId ? t("{name}'s progress", { name: p.name }) : t('My progress')}</h2>
          <span className="small muted">
            {p.weeksActive === 1
              ? t('First week of practice · {n} drawings', { n: p.totalDrawings })
              : t('{w} weeks of practice · {n} drawings', { w: p.weeksActive, n: p.totalDrawings })}
          </span>
        </div>
      )}

      <div className="stats">
        {[
          { v: p.streak, k: t('day streak') },
          { v: p.totalDrawings, k: t('drawings') },
          { v: p.practices, k: t('lessons done') },
          { v: p.badges.filter((b) => b.earned).length, k: t('Badges') },
        ].map((s) => (
          <div key={s.k}>
            <b>{s.v}</b>
            <span>{s.k}</span>
          </div>
        ))}
      </div>

      {p.beforeAfter && shown && (
        <div className="card tight col" style={{ gap: 12 }}>
          <div className="between">
            <h3>{t('Then and now')}</h3>
            <Segmented
              label={t('Before or after')}
              value={view}
              onChange={setView}
              options={[
                { id: 'before', label: t('Before') },
                { id: 'after', label: t('After') },
              ]}
            />
          </div>
          <img src={shown.imageUrl} alt={shown.title} style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 10, background: '#FFFDF6' }} />
          <span className="small bold" style={{ color: view === 'after' ? 'var(--green-ink)' : 'var(--muted)' }}>
            {view === 'before'
              ? t('Your first drawing: {title}', { title: p.beforeAfter.before.title })
              : d && d.by > 0
                ? t('Latest: {title}. Your {skill} improved by {n} points. Nice work!', { title: p.beforeAfter.after.title, skill: t(SKILL_LABEL[d.skill]).toLowerCase(), n: d.by })
                : t('Latest: {title}. Keep practising!', { title: p.beforeAfter.after.title })}
          </span>
        </div>
      )}

      <div className="card col" style={{ gap: 10 }}>
        <h3>{t('Drawings per week')}</h3>
        <div className="grid-4" style={{ gap: 14, alignItems: 'end', height: 130 }} role="img" aria-label={t('Drawings per week') + ': ' + p.weeks.map((w) => w.count).join(', ')}>
          {p.weeks.map((w, i) => (
            <div key={w.start} className="col" style={{ alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
              <span className="small latin" style={{ fontWeight: 900 }}>{w.count}</span>
              <span style={{ width: '100%', borderRadius: '8px 8px 4px 4px', height: Math.max(4, (w.count / max) * 80), background: i === p.weeks.length - 1 ? 'var(--teal)' : 'var(--primary-soft)' }} />
              <span className="tiny bold muted">{i === p.weeks.length - 1 ? t('This wk') : t('Wk {n}', { n: i + 1 })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <div className="between">
          <h3>{userId ? t('Skills') : t('My skills')}</h3>
          {p.skills.basedOn > 0 && <span className="tiny muted">{t('From the last {n} drawings', { n: p.skills.basedOn })}</span>}
        </div>
        <div className="scores">
          {(['composition', 'colour', 'light', 'proportion'] as const).map((k) => {
            const n = toFive(p.skills.scores[k]);
            return (
              <div key={k} className="score" style={{ background: 'var(--paper)' }}>
                <div className="lbl">
                  <span>{t(SKILL_LABEL[k])}</span>
                  <span className="latin">{n}/5</span>
                </div>
                <ScoreDots n={n} />
                <div className="tiny muted" style={{ marginTop: 4 }}>{skillWord(p.skills.scores[k], t)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        <h2 className="h2">{t('Badges')}</h2>
        <div className="grid-3">
          {p.badges.map((b) => (
            <div key={b.code} className="card col" title={b.hint} style={{ alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 16, opacity: b.earned ? 1 : 0.55 }}>
              <BadgeMedal icon={b.icon} color={b.color} earned={b.earned} />
              <span className={`tiny bold center ${ur ? 'ur' : ''}`} style={{ lineHeight: ur ? 1.9 : 1.3 }}>{ur ? b.nameUr : b.name}</span>
              {!b.earned && <span className="tiny muted center" style={{ fontSize: 10, lineHeight: 1.3 }}>{t(b.hint)}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Progress() {
  return (
    <div className="screen with-nav" style={{ gap: 18 }}>
      <ProgressView />
    </div>
  );
}
