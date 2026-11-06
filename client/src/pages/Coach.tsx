import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, downscale } from '../api';
import { useAuth } from '../auth';
import { pick, useT } from '../i18n';
import { EXAMPLE, getExampleURL, Markers, Result } from '../components/Coach';
import { useFetch, useToast } from '../components/ui';
import { DrawingThumb } from './Home';
import type { Challenge, Drawing, Lesson } from '../types';

type HomeData = {
  challenge: (Challenge & { joined: boolean; submitted: boolean }) | null;
  drawings: Drawing[];
};
type Status = null | { kind: 'sending' | 'thinking' } | { kind: 'error'; msg: string; code?: string; retryId?: string };

export function Coach() {
  const { t, lang } = useT();
  const toast = useToast();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const home = useFetch<HomeData>('/api/home');
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [current, setCurrent] = useState<Drawing | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  // set on every mount (React dev mode mounts twice), cleared when leaving the screen
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  const challenge = home.data?.challenge;
  const forChallenge = params.get('challenge') === '1' && challenge?.joined && !challenge.submitted;
  const busy = status?.kind === 'sending' || status?.kind === 'thinking';

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setStatus({ kind: 'error', msg: t('Please choose a JPG, PNG or WebP photo.') });
    setPicked({ blob: f, url: URL.createObjectURL(f) });
    setCurrent(null);
    setStatus(null);
  };

  const poll = async (id: string) => {
    const started = Date.now();
    while (alive.current) {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await api.get<{ drawing: Drawing; suggestedLesson: Lesson | null }>(`/api/drawings/${id}`);
      if (r.drawing.status === 'processing') {
        if (Date.now() - started > 4 * 60 * 1000) throw new ApiError(0, t('The coach is busy right now. Try again in a minute.'));
        continue;
      }
      return r;
    }
    return null;
  };

  const getTips = async () => {
    if (!picked) return;
    setStatus({ kind: 'sending' });
    try {
      const fd = new FormData();
      fd.append('mode', 'paper');
      fd.append('image', await downscale(picked.blob), 'drawing.jpg');
      const { drawing } = await api.post<{ drawing: Drawing }>('/api/drawings', fd);
      setStatus({ kind: 'thinking' });
      await waitFor(drawing.id);
    } catch (e) {
      const a = e as ApiError;
      setStatus({ kind: 'error', msg: a.message, code: a.code });
      if (a.code === 'time_limit') void refresh();
    }
  };

  const waitFor = async (id: string) => {
    const r = await poll(id);
    if (!r) return;
    void home.reload();
    void refresh();
    if (r.drawing.status === 'done') {
      setCurrent(r.drawing);
      setLesson(r.suggestedLesson);
      setStatus(null);
    } else if (r.drawing.status === 'rejected') {
      setStatus({ kind: 'error', msg: r.drawing.error || t("The coach couldn't read that photo. Try a clearer photo in good light.") });
    } else {
      setStatus({ kind: 'error', msg: t("The coach couldn't read that photo. Try a clearer photo in good light."), retryId: id });
    }
  };

  const retry = async (id: string) => {
    setStatus({ kind: 'thinking' });
    try {
      await api.post(`/api/drawings/${id}/retry`);
      await waitFor(id);
    } catch (e) {
      setStatus({ kind: 'error', msg: (e as Error).message });
    }
  };

  const enter = async () => {
    if (!challenge || !current) return;
    try {
      await api.post(`/api/challenges/${challenge.id}/submit`, { drawingId: current.id });
      toast(t('Entered in the challenge. Good luck!'));
      void home.reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const src = picked ? picked.url : getExampleURL();
  const showExample = !picked && !current;

  return (
    <div className="screen">
      <div>
        <h2>{forChallenge && challenge ? pick(lang, challenge, 'title', 'titleUr') : t('Coach my drawing')}</h2>
        <div className="muted">{t('Take a clear photo of your drawing in good light, then tap Get tips.')}</div>
      </div>

      <div className="drawbox">
        <img src={src} alt={picked ? t('Your drawing') : t('Example drawing')} />
        <span className="badge">{picked ? t('Your drawing') : t('Example drawing')}</span>
        {current && <Markers tips={current.tips} />}
      </div>

      {busy ? (
        <div className="status" role="status">
          <div className="spin" />
          <span>{status?.kind === 'sending' ? t('Sending your drawing…') : t('Your coach is looking at your drawing…')}</span>
        </div>
      ) : (
        <>
          <div className="btns">
            <label className="btn ghost" htmlFor="file">
              📷 {current ? t('Coach another drawing') : picked ? t('Choose another') : t('Upload a photo')}
              <input ref={fileRef} type="file" id="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
            </label>
            {!current && (
              <button className="btn teal" onClick={getTips} disabled={!picked}>
                {t('Get tips')}
              </button>
            )}
          </div>
          {status?.kind === 'error' && (
            <div className="status err" role="alert">
              <span className="grow">{status.msg}</span>
              {status.retryId && <button className="btn sm" onClick={() => retry(status.retryId!)}>{t('Try again')}</button>}
            </div>
          )}
        </>
      )}

      {current && (
        <>
          <Result d={current} lesson={lesson} note={current.provider === 'mock' ? t('Demo coach: connect the AI model for real feedback.') : t("Tips from Smart Art's AI coach. It gives advice and never redraws your art.")} />
          {challenge?.joined && !challenge.submitted && (
            <button className="btn primary block" onClick={enter}>
              🏆 {t('Enter this in the challenge')}
            </button>
          )}
          <div className="btns">
            {lesson && <Link to={`/app/lessons/${lesson.slug}`} className="btn ghost">{t('Try: {title}', { title: pick(lang, lesson, 'title', 'titleUr') })}</Link>}
            <Link to={`/app/drawings/${current.id}`} className="btn ghost">{t('Open drawing')}</Link>
          </div>
        </>
      )}

      {showExample && !busy && <Result d={EXAMPLE} note={t('Example feedback. Upload your own drawing to get real tips.')} />}

      {home.data && home.data.drawings.length > 0 && (
        <div className="col" style={{ gap: 10 }}>
          <div className="between">
            <h3>{t('My drawings')}</h3>
            <Link to="/app/drawings" className="small bold">{t('See all')}</Link>
          </div>
          <div className="thumbs">
            {home.data.drawings.slice(0, 3).map((d) => (
              <DrawingThumb key={d.id} d={d} to={`/app/drawings/${d.id}`} />
            ))}
          </div>
        </div>
      )}

      <div className="safe">{t('Safe for kids · No ads · No chat with strangers')}</div>
    </div>
  );
}
