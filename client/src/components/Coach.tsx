import { useT } from '../i18n';
import type { Drawing, Lesson, Scores, Skill, Tip } from '../types';

// ------------------------------------------------------------------ example drawing (from the prototype)
function exampleCanvas() {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, 800, 600);
  g.lineCap = g.lineJoin = 'round';
  g.fillStyle = '#9fd0ef';
  g.fillRect(30, 30, 740, 300);
  g.fillStyle = '#ffd23a';
  g.beginPath();
  g.arc(140, 110, 55, 0, 7);
  g.fill();
  g.strokeStyle = '#f0b400';
  g.lineWidth = 6;
  for (let a = 0; a < 12; a++) {
    const r = (a * Math.PI) / 6;
    g.beginPath();
    g.moveTo(140 + Math.cos(r) * 68, 110 + Math.sin(r) * 68);
    g.lineTo(140 + Math.cos(r) * 92, 110 + Math.sin(r) * 92);
    g.stroke();
  }
  g.fillStyle = '#6fbf5a';
  g.beginPath();
  g.moveTo(30, 360);
  g.quadraticCurveTo(220, 220, 420, 340);
  g.quadraticCurveTo(600, 230, 770, 330);
  g.lineTo(770, 570);
  g.lineTo(30, 570);
  g.fill();
  g.fillStyle = '#4fa64a';
  g.beginPath();
  g.moveTo(30, 430);
  g.quadraticCurveTo(300, 350, 770, 420);
  g.lineTo(770, 570);
  g.lineTo(30, 570);
  g.fill();
  g.fillStyle = '#d9b98a';
  g.beginPath();
  g.moveTo(330, 570);
  g.quadraticCurveTo(380, 480, 430, 420);
  g.lineTo(460, 420);
  g.quadraticCurveTo(450, 490, 470, 570);
  g.fill();
  g.fillStyle = '#f2e2c4';
  g.fillRect(380, 300, 170, 125);
  g.fillStyle = '#c8553d';
  g.beginPath();
  g.moveTo(365, 302);
  g.lineTo(465, 225);
  g.lineTo(565, 302);
  g.closePath();
  g.fill();
  g.fillStyle = '#7a4a2a';
  g.fillRect(432, 385, 34, 40);
  g.fillStyle = '#8fd3f4';
  g.fillRect(400, 330, 36, 32);
  g.fillRect(494, 330, 36, 32);
  g.strokeStyle = '#2b2b2b';
  g.lineWidth = 3;
  g.strokeRect(380, 300, 170, 125);
  g.strokeRect(400, 330, 36, 32);
  g.strokeRect(494, 330, 36, 32);
  g.strokeRect(432, 385, 34, 40);
  g.beginPath();
  g.moveTo(365, 302);
  g.lineTo(465, 225);
  g.lineTo(565, 302);
  g.closePath();
  g.stroke();
  g.fillStyle = '#8a5a33';
  g.fillRect(640, 330, 26, 100);
  g.fillStyle = '#3e8f3e';
  for (const [x, y, r] of [
    [653, 300, 60],
    [615, 330, 40],
    [692, 330, 40],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  g.strokeStyle = '#333';
  g.lineWidth = 3;
  for (const [x, y] of [
    [300, 110],
    [350, 90],
    [560, 130],
  ]) {
    g.beginPath();
    g.moveTo(x - 14, y);
    g.quadraticCurveTo(x - 7, y - 10, x, y);
    g.quadraticCurveTo(x + 7, y - 10, x + 14, y);
    g.stroke();
  }
  return c;
}

let exampleURL: string | null = null;
export function getExampleURL() {
  if (!exampleURL) exampleURL = exampleCanvas().toDataURL('image/png');
  return exampleURL;
}

/** Example feedback shown before the student has coached a drawing of their own. */
export const EXAMPLE: Pick<Drawing, 'praise' | 'tips' | 'scores' | 'exercise'> = {
  praise: {
    en: { title: '', text: 'Great composition! Your house, tree and hills fill the page well, and the path leads the eye into the picture.' },
    ur: { title: '', text: 'بہترین ترتیب! گھر، درخت اور پہاڑیاں صفحے کو اچھی طرح بھرتی ہیں، اور راستہ نظر کو تصویر کے اندر لے جاتا ہے۔' },
  },
  scores: { composition: 80, colour: 60, light: 40, proportion: 60 },
  tips: [
    { area: 'colour', x: 0.2, y: 0.2, en: 'Try a warm orange sky near the sun, fading to light blue at the top.', ur: 'سورج کے پاس آسمان گرم نارنجی بنائیں اور اوپر جا کر ہلکا نیلا کریں۔', why: { en: 'Warm colours make a sunny scene feel bright and alive.', ur: 'گرم رنگ دھوپ والے منظر کو روشن بناتے ہیں۔' } },
    { area: 'light', x: 0.72, y: 0.62, en: 'Add a shadow on the right side of the house and tree.', ur: 'گھر اور درخت کی دائیں طرف سایہ بنائیں۔', why: { en: 'The sun is on the left, so shadows fall to the right. This makes things look solid.', ur: 'سورج بائیں طرف ہے، اس لیے سایہ دائیں طرف پڑے گا۔ اس سے چیزیں ٹھوس لگتی ہیں۔' } },
    { area: 'proportion', x: 0.56, y: 0.68, en: 'Make the door a little taller, about half the height of the wall.', ur: 'دروازہ تھوڑا لمبا کریں، دیوار کی آدھی اونچائی جتنا۔', why: { en: 'A door that fits a person makes the house look real.', ur: 'صحیح سائز کا دروازہ گھر کو اصلی دکھاتا ہے۔' } },
  ],
  exercise: {
    en: 'Draw three balls on one page. Put the sun in a different place each time and shade the side away from the sun.',
    ur: 'ایک صفحے پر تین گیندیں بنائیں۔ ہر بار سورج الگ جگہ رکھیں اور سورج سے دور والی طرف سایہ کریں۔',
  },
};

/** Numbered tip markers on the drawing, nudged apart when the model points at nearly the same spot. */
export function Markers({ tips }: { tips: Tip[] }) {
  const placed: { x: number; y: number }[] = [];
  for (const t of tips) {
    let { x, y } = t;
    for (let tries = 0; tries < 6 && placed.some((p) => Math.abs(p.x - x) < 0.09 && Math.abs(p.y - y) < 0.12); tries++) {
      x = x > 0.8 ? x - 0.1 : x + 0.1;
      if (tries % 2) y = y > 0.8 ? y - 0.12 : y + 0.12;
    }
    placed.push({ x: Math.min(0.95, Math.max(0.05, x)), y: Math.min(0.95, Math.max(0.05, y)) });
  }
  return (
    <>
      {placed.map((p, i) => (
        <span key={i} className="marker" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} aria-hidden="true">
          {i + 1}
        </span>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ result panel
export const SKILL_NAME: Record<Skill, string> = { composition: 'Composition', colour: 'Colour', light: 'Light', proportion: 'Proportion' };
export const toFive = (pct: number) => Math.max(0, Math.min(5, Math.round(pct / 20)));

export function ScoreDots({ n }: { n: number }) {
  return (
    <div className="dots" aria-label={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </div>
  );
}

export function SkillGrid({ scores }: { scores: Scores }) {
  const { t } = useT();
  return (
    <div className="scores">
      {(['composition', 'colour', 'light', 'proportion'] as const).map((k) => {
        const n = toFive(scores[k]);
        return (
          <div key={k} className="score">
            <div className="lbl">
              <span>{t(SKILL_NAME[k])}</span>
              <span className="latin">{n}/5</span>
            </div>
            <ScoreDots n={n} />
          </div>
        );
      })}
    </div>
  );
}

/** The coach's feedback: what's working, skills, 3 tips with reasons, and a practice exercise. */
export function Result({ d, note, lesson }: { d: Pick<Drawing, 'praise' | 'tips' | 'scores' | 'exercise'>; note?: string; lesson?: Lesson | null }) {
  const { t, ur } = useT();
  const L = (o?: { en: string; ur: string } | null) => (o ? (ur ? o.ur || o.en : o.en) : '');
  const tips: Tip[] = d.tips.slice(0, 3);
  return (
    <section className="result" aria-live="polite">
      {d.praise && (
        <div className="strength">
          <div className="star" aria-hidden="true">★</div>
          <div>
            <h3>{t("What's working")}</h3>
            <p style={{ marginTop: 2 }}>{ur ? d.praise.ur.text || d.praise.en.text : d.praise.en.text}</p>
          </div>
        </div>
      )}
      {d.scores && (
        <div>
          <h3 style={{ marginBottom: 8 }}>{t('Your skills')}</h3>
          <SkillGrid scores={d.scores} />
        </div>
      )}
      {tips.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>{tips.length === 3 ? t('3 tips to try next time') : t('Tips to try next time')}</h3>
          <div className="col" style={{ gap: 8 }}>
            {tips.map((x, i) => (
              <div key={i} className="tip">
                <div className="n">{i + 1}</div>
                <div>
                  <div className="area">{t(SKILL_NAME[x.area])}</div>
                  <p>
                    <b>{ur ? x.ur || x.en : x.en}</b>
                  </p>
                  {x.why && L(x.why) && <div className="why">{L(x.why)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.exercise && L(d.exercise) && (
        <div className="exercise">
          <b>{t('Practice exercise')}</b>
          <div>{L(d.exercise)}</div>
          {lesson && <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>{t('Related lesson: {title}', { title: ur && lesson.titleUr ? lesson.titleUr : lesson.title })}</div>}
        </div>
      )}
      {note && <div className="note">{note}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ lesson tiles (prototype colours + icons)
const LESSON_TILE: Record<Lesson['category'], { c: string; icon: JSX.Element }> = {
  colour: {
    c: '#F4B942',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
      </svg>
    ),
  },
  light: {
    c: '#E86A5A',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="M10 4a6 6 0 0 1 0 12z" fill="#fff" />
        <path d="M14 18l6 3" />
      </svg>
    ),
  },
  proportion: {
    c: '#13707F',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="7" ry="9" />
        <path d="M5 11h14M9 10.5v.5M15 10.5v.5M12 12v3M10 17h4" />
      </svg>
    ),
  },
  composition: {
    c: '#66797C',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16M15 4v16M3 9.3h18M3 14.7h18" />
      </svg>
    ),
  },
  perspective: {
    c: '#4E9A4A',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M2 9h20M4 21l8-12 8 12M12 13v2M12 18v3" />
      </svg>
    ),
  },
  shapes: {
    c: '#8C6BC8',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="4" />
        <rect x="13" y="4" width="8" height="8" rx="1" />
        <path d="M12 21l-5-8-5 8z" />
      </svg>
    ),
  },
};

export function LessonTile({ category, size = 54 }: { category: Lesson['category']; size?: number }) {
  const tile = LESSON_TILE[category] || LESSON_TILE.colour;
  return (
    <div className="th" style={{ background: tile.c, width: size, height: size }}>
      {tile.icon}
    </div>
  );
}
