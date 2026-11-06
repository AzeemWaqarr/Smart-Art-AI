import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { pick, useT } from '../i18n';
import { LessonTile } from '../components/Coach';
import { ErrorState, Segmented, Spinner, useFetch, useToast } from '../components/ui';
import { categoryName } from './Home';
import type { Lesson } from '../types';

/** "Short lessons" list. */
export function PracticeList() {
  const { t, lang, ur } = useT();
  const arrow = ur ? '←' : '→';
  const { data, error, loading, reload } = useFetch<{ lessons: Lesson[] }>('/api/lessons');
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const all = data!.lessons;
  const lessons = all.filter((l) => (filter === 'all' ? true : filter === 'done' ? l.completed : !l.completed));
  return (
    <div className="screen">
      <div>
        <h2>{t('Short lessons')}</h2>
        <div className="muted">{t('Five minutes each. Learn one idea, then practise it.')}</div>
      </div>
      <Segmented
        label={t('Filter lessons')}
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: `${t('All')} · ${all.length}` },
          { id: 'todo', label: t('To do') },
          { id: 'done', label: `${t('Done')} · ${all.filter((l) => l.completed).length}` },
        ]}
      />
      {lessons.map((l) => (
        <Link key={l.id} to={`/app/lessons/${l.slug}`} className="lesson">
          <LessonTile category={l.category} />
          <div>
            <b>{pick(lang, l, 'title', 'titleUr')}</b>
            <div className="meta">
              {l.durationMin} {t('min')} · {t(categoryName(l.category))}
            </div>
          </div>
          <span className="done">{l.completed ? `✓ ${t('Done')}` : `${t('Open')} ${arrow}`}</span>
        </Link>
      ))}
      {lessons.length === 0 && <p className="muted center">{t('Nothing here yet.')}</p>}
    </div>
  );
}

/** One lesson: steps to try, mark as practised, then get the drawing coached. */
export function LessonPage() {
  const { slug } = useParams();
  const { t, lang, ur } = useT();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch<{ lesson: Lesson }>(`/api/lessons/${slug}`, [slug]);
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [opened] = useState(() => Date.now());

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const l = data!.lesson;

  const count = Object.values(ticked).filter(Boolean).length;
  const markDone = async () => {
    try {
      const r = await api.post<{ newBadges: string[] }>('/api/practice', {
        lessonId: l.id,
        stepsDone: l.steps.length,
        seconds: Math.min(4 * 3600, Math.round((Date.now() - opened) / 1000)),
      });
      setSaved(true);
      toast(r.newBadges.length ? t('Lesson done, and you earned a new badge!') : t('Lesson done. Great practice!'));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="screen">
      <Link to="/app/lessons" className="btn ghost" style={{ alignSelf: 'flex-start' }}>
        <span className="flip" style={{ display: 'inline-block' }}>←</span> {t('Back to lessons')}
      </Link>
      <div className="lesson" style={{ cursor: 'default' }}>
        <LessonTile category={l.category} />
        <div>
          <h2>{pick(lang, l, 'title', 'titleUr')}</h2>
          <div className="meta">
            {l.durationMin} {t('min')} · {t(categoryName(l.category))}
          </div>
        </div>
      </div>
      <p className="muted">{pick(lang, l, 'summary', 'summaryUr')}</p>
      <div className="lessonbody">
        <h3>{t('Try this')}</h3>
        <ol>
          {l.steps.map((st, i) => (
            <li key={i} className={ticked[i] ? 'ticked' : ''}>
              <button type="button" role="checkbox" aria-checked={!!ticked[i]} onClick={() => setTicked({ ...ticked, [i]: !ticked[i] })}>
                {ur && st.ur ? st.ur : st.en}
              </button>
            </li>
          ))}
        </ol>
        <div className="tiny muted" style={{ marginTop: 8 }}>{t('Tap a step when you have done it.')} {count > 0 && `(${count}/${l.steps.length})`}</div>
      </div>
      {saved || l.completed ? (
        <div className="ok-box">✓ {saved ? t('Saved to your progress.') : t('You have done this lesson before. Practise again any time!')}</div>
      ) : null}
      {!saved && (
        <button className="btn ghost block" onClick={markDone}>
          ✓ {t('I practised this')}
        </button>
      )}
      <Link to="/app/coach" className="btn primary full">📷 {t('Coach my drawing')}</Link>
    </div>
  );
}
