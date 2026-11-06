import { Link, useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { pick, useT } from '../i18n';
import { LessonTile } from '../components/Coach';
import { ErrorState, Spinner, useAction, useFetch, useToast } from '../components/ui';
import type { Challenge, Drawing, Lesson } from '../types';

type HomeData = {
  week: { drawings: number; tips: number; lessons: number; badges: number };
  streak: number;
  todaysLesson: Lesson | null;
  challenge: (Challenge & { joined: boolean; submitted: boolean }) | null;
  drawings: Drawing[];
};

export function DrawingThumb({ d, to }: { d: Drawing; to: string }) {
  const { t, lang } = useT();
  return (
    <Link to={to} className="col" style={{ gap: 6, textDecoration: 'none', color: 'var(--ink)' }} aria-label={`${d.title}, ${d.status === 'done' ? t('feedback ready') : t(d.status)}`}>
      <div style={{ position: 'relative' }}>
        <img src={d.imageUrl} alt="" className="thumb" loading="lazy" />
        {d.status === 'processing' && <span className="tag blue" style={{ position: 'absolute', bottom: 6, insetInlineStart: 6 }}>{t('Looking…')}</span>}
        {(d.status === 'failed' || d.status === 'rejected') && <span className="tag try" style={{ position: 'absolute', bottom: 6, insetInlineStart: 6 }}>{t('Needs retry')}</span>}
      </div>
      <span className="tiny bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.title} · {timeAgo(d.createdAt, lang)}
      </span>
    </Link>
  );
}

export function categoryName(c: string) {
  return { light: 'Light and shadow', colour: 'Colour', proportion: 'Proportion', composition: 'Composition', perspective: 'Perspective', shapes: 'Shapes' }[c] || c;
}

export function Home() {
  const { user } = useAuth();
  const { t, lang, ur } = useT();
  const arrow = ur ? '←' : '→';
  const toast = useToast();
  const nav = useNavigate();
  const { data, error, loading, reload } = useFetch<HomeData>('/api/home');
  const act = useAction();

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const c = data.challenge;
  const startChallenge = async () => {
    if (!c) return;
    await act.run(async () => {
      try {
        if (!c.joined) await api.post(`/api/challenges/${c.id}/join`);
        nav('/app/coach?challenge=1');
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    });
  };
  const kicker = c?.period === 'day' ? t("Today's challenge") : c?.period === 'week' ? t("This week's challenge") : t('Monthly art challenge');
  const w = data.week;

  return (
    <div className="screen">
      <div className="hello">
        <div>
          <h2>{t('Assalam o Alaikum, {name}!', { name: user?.name || t('artist') })}</h2>
          <div className="muted">{t('Ready to draw today?')}</div>
        </div>
        <span className="streak">🔥 {t('{n}-day streak', { n: data.streak })}</span>
      </div>

      {c && (
        <section className="challenge">
          <div className="blob" />
          <div className="blob2" />
          <div>
            <div className="k">{kicker}</div>
            <h3>{pick(lang, c, 'title', 'titleUr')}</h3>
            <p>{pick(lang, c, 'description', 'descriptionUr')}</p>
          </div>
          {c.submitted ? (
            <span className="btn success" style={{ pointerEvents: 'none' }}>✓ {t('Your drawing is entered. Good luck!')}</span>
          ) : (
            <button type="button" className="btn primary" disabled={act.busy} onClick={startChallenge}>
              {c.joined ? t('Snap my entry') : t('Start the challenge')}
            </button>
          )}
        </section>
      )}

      <Link to="/app/progress" className="card" aria-label={t('Your week') + ', ' + t('See progress')}>
        <div className="between" style={{ marginBottom: 8 }}>
          <h3>{t('Your week')}</h3>
          <span className="tiny bold" style={{ color: 'var(--teal)' }}>{t('See progress')} {arrow}</span>
        </div>
        <div className="stats">
          <div><b>{w.drawings}</b><span>{t('Drawings')}</span></div>
          <div><b>{w.tips}</b><span>{t('Tips used')}</span></div>
          <div><b>{w.lessons}</b><span>{t('Lessons')}</span></div>
          <div><b>{w.badges}</b><span>{t('Badges')}</span></div>
        </div>
      </Link>

      {data.todaysLesson && (
        <Link to={`/app/lessons/${data.todaysLesson.slug}`} className="lesson">
          <LessonTile category={data.todaysLesson.category} />
          <div>
            <b>{pick(lang, data.todaysLesson, 'title', 'titleUr')}</b>
            <div className="meta">{data.todaysLesson.durationMin} {t('min')}</div>
          </div>
          <span className="done">{data.todaysLesson.completed ? `✓ ${t('Done')}` : `${t('Open')} ${arrow}`}</span>
        </Link>
      )}

      <div className="safe">{t('Safe for kids · No ads · No chat with strangers')}</div>
    </div>
  );
}
