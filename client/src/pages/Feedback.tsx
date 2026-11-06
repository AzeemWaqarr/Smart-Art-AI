import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { pick, useT } from '../i18n';
import { Icon } from '../components/Icon';
import { Markers, Result } from '../components/Coach';
import { BackButton, ErrorState, Spinner, useFetch, useToast } from '../components/ui';
import { DrawingThumb } from './Home';
import type { Drawing, Lesson } from '../types';

type Detail = { drawing: Drawing; suggestedLesson: Lesson | null; challenge: { id: string; title: string; submittedDrawingId: string | null } | null };

/** One drawing with the coach's feedback. Used by students and (read-only-ish) by parents. */
export function Feedback() {
  const { id } = useParams();
  const { t, lang } = useT();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const isParent = user?.role === 'parent';
  const { data, error, loading, reload, setData } = useFetch<Detail>(`/api/drawings/${id}`, [id]);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (data?.drawing.status !== 'processing') return;
    const tm = setTimeout(reload, 2500);
    return () => clearTimeout(tm);
  }, [data, reload]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const d = data.drawing;

  const retry = async () => {
    try {
      const r = await api.post<{ drawing: Drawing }>(`/api/drawings/${d.id}/retry`);
      setData({ ...data, drawing: r.drawing });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const remove = async () => {
    if (!confirm(t('Delete this drawing? This cannot be undone.'))) return;
    try {
      await api.del(`/api/drawings/${d.id}`);
      toast(t('Drawing deleted'));
      if (isParent) nav(-1);
      else nav('/app/drawings', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const saveTitle = async () => {
    try {
      const r = await api.patch<{ drawing: Drawing }>(`/api/drawings/${d.id}`, { title });
      setData({ ...data, drawing: r.drawing });
      setRenaming(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const enter = async () => {
    if (!data.challenge) return;
    try {
      await api.post(`/api/challenges/${data.challenge.id}/submit`, { drawingId: d.id });
      setData({ ...data, challenge: { ...data.challenge, submittedDrawingId: d.id } });
      toast(t('Entered in the challenge. Good luck!'));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="screen">
      <div className="row">
        {isParent ? <BackButton /> : <BackButton to="/app/drawings" />}
        {renaming ? (
          <form className="row grow" onSubmit={(e) => (e.preventDefault(), saveTitle())}>
            <input className="input" style={{ minHeight: 40 }} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} autoFocus aria-label={t('Drawing name')} />
            <button className="btn sm">{t('Save')}</button>
          </form>
        ) : (
          <div className="col grow" style={{ gap: 0 }}>
            <h2 style={{ fontSize: 20 }}>{d.title}</h2>
            <span className="tiny muted">{timeAgo(d.createdAt, lang)}</span>
          </div>
        )}
      </div>

      <div className="drawbox">
        <img src={d.imageUrl} alt={d.title} />
        {d.status === 'done' && <Markers tips={d.tips} />}
      </div>

      {d.status === 'processing' && (
        <div className="status" role="status">
          <div className="spin" />
          <span>{t('Your coach is looking at your drawing…')}</span>
        </div>
      )}
      {(d.status === 'failed' || d.status === 'rejected') && (
        <div className="status err" role="alert">
          <span className="grow">{d.status === 'rejected' ? d.error : t("The coach couldn't read that photo. Try a clearer photo in good light.")}</span>
          {d.status === 'failed' && !isParent && <button className="btn sm" onClick={retry}>{t('Try again')}</button>}
        </div>
      )}

      {d.status === 'done' && (
        <Result
          d={d}
          lesson={data.suggestedLesson}
          note={d.provider === 'mock' ? t('Demo coach: connect the AI model for real feedback.') : t("Tips from Smart Art's AI coach. It gives advice and never redraws your art.")}
        />
      )}

      {!isParent && d.status === 'done' && data.challenge && (
        data.challenge.submittedDrawingId === d.id ? (
          <div className="ok-box">🏆 {t('This drawing is your challenge entry.')}</div>
        ) : (
          <button className="btn primary block" onClick={enter}>
            🏆 {data.challenge.submittedDrawingId ? t('Use this for the challenge instead') : t('Enter this in the challenge')}
          </button>
        )
      )}

      {!isParent && (
        <div className="btns">
          {data.suggestedLesson && d.status === 'done' && (
            <Link to={`/app/lessons/${data.suggestedLesson.slug}`} className="btn ghost">
              {t('Try: {title}', { title: pick(lang, data.suggestedLesson, 'title', 'titleUr') })}
            </Link>
          )}
          <Link to="/app/coach" className="btn teal">📷 {t('Coach another drawing')}</Link>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
        {!isParent && !renaming && (
          <button className="btn link" onClick={() => (setTitle(d.title), setRenaming(true))}>
            <Icon name="edit" size={16} /> {t('Rename')}
          </button>
        )}
        <button className="btn link" style={{ color: 'var(--coral-ink)' }} onClick={remove}>
          <Icon name="trash" size={16} /> {t('Delete')}
        </button>
      </div>
    </div>
  );
}

export function DrawingsList() {
  const { t } = useT();
  const { data, error, loading, reload } = useFetch<{ drawings: Drawing[] }>('/api/drawings');
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="screen">
      <div className="row">
        <BackButton to="/app/coach" />
        <h2 className="grow">{t('My drawings')}</h2>
      </div>
      {data!.drawings.length === 0 ? (
        <div className="center-fill">
          <span style={{ fontSize: 36 }} aria-hidden="true">🎨</span>
          <span className="bold">{t('No drawings yet')}</span>
          <Link to="/app/coach" className="btn teal">📷 {t('Coach my drawing')}</Link>
        </div>
      ) : (
        <div className="thumbs">
          {data!.drawings.map((d) => (
            <DrawingThumb key={d.id} d={d} to={`/app/drawings/${d.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
