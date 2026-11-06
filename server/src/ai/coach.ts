import crypto from 'node:crypto';
import { aiIsReal, env } from '../env.js';
import { SKILLS, type Scores, type Skill } from '../services/stats.js';

type Bi = { en: string; ur: string };
export type Tip = { area: Skill; x: number; y: number; en: string; ur: string; why: Bi };
export type Feedback = {
  isDrawing: boolean;
  subject: string;
  praise: { en: { title: string; text: string }; ur: { title: string; text: string } };
  tips: Tip[];
  scores: Scores; // stored 0..100 (the model answers 1..5; we multiply by 20)
  exercise: Bi;
};
export type CoachResult = Feedback & { provider: 'openai' | 'mock'; model: string };

export type CoachInput = {
  image: Buffer;
  mime: string;
  mode: 'paper' | 'screen';
  age: number | null;
  language: 'en' | 'ur';
};

const SYSTEM_PROMPT = `You are Smart Art, a warm, encouraging art coach for children aged 10 to 16 in Pakistan.
You look at a photo of the child's OWN drawing.

Rules:
- Coach, don't copy. Never offer to redraw it or describe how YOU would draw it. Never mock or compare the child to others.
- Be kind and specific to what you actually see. Short sentences a 12-year-old understands.
- "strength": one or two sentences on what is working well.
- "scores": 1 to 5 for composition, colour, light and proportion, fair for the child's age.
- "tips": exactly 3. Each is one concrete thing to try next time ("tip") and one short sentence on why it helps ("why").
  "area" is one of: composition, colour, light, proportion.
  "x" and "y" are where on the image the tip applies, as fractions 0..1 from the top-left.
- "exercise": one 5-minute practice exercise that targets the weakest skill.
- Write every text in BOTH English ("en") and Urdu in Urdu script ("ur").
- If the image is not a drawing or painting (a selfie, a screenshot of text, something unsafe), set "is_drawing": false.

Reply with ONLY one JSON object, no markdown, in exactly this shape:
{
  "is_drawing": true,
  "subject": "house and tree",
  "strength": { "en": "...", "ur": "..." },
  "scores": { "composition": 4, "colour": 3, "light": 2, "proportion": 3 },
  "tips": [
    { "area": "colour", "x": 0.3, "y": 0.2, "en": { "tip": "...", "why": "..." }, "ur": { "tip": "...", "why": "..." } }
  ],
  "exercise": { "en": "...", "ur": "..." }
}`;

function userPrompt(i: CoachInput) {
  const who = i.age ? `The artist is about ${i.age} years old.` : 'The artist is a young student.';
  const where = i.mode === 'screen' ? 'It is a digital drawing (on a screen).' : 'It is a drawing on paper, photographed with a phone.';
  return `${who} ${where} Their preferred language is ${i.language === 'ur' ? 'Urdu' : 'English'}. Give your feedback as JSON.`;
}

// ------------------------------------------------------------------ real model
type ChatMessage = { role: 'system' | 'user'; content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] };

/**
 * One chat completion against the OpenAI-compatible endpoint.
 * Qwen3 models "think" before answering by default; when AI_DISABLE_THINKING is on we ask the server to skip it
 * (chat_template_kwargs for vLLM/SGLang, `think:false` for Ollama, and the `/no_think` soft switch in the prompt).
 * If the server rejects those extra fields we retry once without them.
 */
async function chat(messages: ChatMessage[], opts: { maxTokens: number; timeoutMs: number; json?: boolean }) {
  const url = `${env.ai.baseUrl}/chat/completions`;
  const base: Record<string, unknown> = { model: env.ai.model, temperature: 0.4, max_tokens: opts.maxTokens, messages };
  if (opts.json && env.ai.jsonMode) base.response_format = { type: 'json_object' };
  const extras: Record<string, unknown> = env.ai.disableThinking ? { chat_template_kwargs: { enable_thinking: false }, think: false } : {};

  const attempt = async (body: Record<string, unknown>) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(env.ai.apiKey ? { Authorization: `Bearer ${env.ai.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      throw new Error(
        ctrl.signal.aborted
          ? `AI model timed out after ${opts.timeoutMs / 1000}s`
          : `Could not reach AI model at ${env.ai.baseUrl}: ${cause?.code || cause?.message || (e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await attempt({ ...base, ...extras });
  if (res.status === 400 && Object.keys(extras).length) res = await attempt(base); // server didn't like the extras
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI model returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string | { text?: string }[] | null } }[] };
  const choice = data.choices?.[0];
  const raw = choice?.message?.content;
  const content = Array.isArray(raw) ? raw.map((p) => p.text || '').join('') : raw || '';
  return { content, finishReason: choice?.finish_reason };
}

const withNoThink = (text: string) => (env.ai.disableThinking ? `${text} /no_think` : text);

async function callOpenAICompatible(i: CoachInput): Promise<CoachResult> {
  const { content, finishReason } = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: withNoThink(userPrompt(i)) },
          { type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.image.toString('base64')}` } },
        ],
      },
    ],
    { maxTokens: env.ai.maxTokens, timeoutMs: env.ai.timeoutMs, json: true },
  );
  const parsed = extractJson(content);
  if (!parsed) {
    const hint = finishReason === 'length' ? ' (reply was cut off: raise AI_MAX_TOKENS or keep AI_DISABLE_THINKING=true)' : '';
    throw new Error(`AI reply was not valid JSON${hint}: ${content.slice(0, 200)}`);
  }
  return { ...normalise(parsed), provider: 'openai', model: env.ai.model };
}

/** Pull the first balanced {...} block out of a model reply (handles ```json fences, <think> blocks, chatter). */
export function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(cleaned.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
};
const str = (v: unknown, d = '') => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 400) : d);
const AREA_ALIASES: Record<string, Skill> = { color: 'colour', colour: 'colour', light: 'light', shading: 'light', shadow: 'light', proportion: 'proportion', proportions: 'proportion', size: 'proportion', composition: 'composition', layout: 'composition' };

/** A model score may come as 1..5 (asked for) or 0..100 (older prompt); store 0..100. */
function toPercent(v: unknown) {
  const n = clamp(v, 0, 100, 3);
  return Math.round(n <= 5 ? n * 20 : n);
}

/** Turns whatever the model returned into a safe, complete Feedback object. */
export function normalise(p: any): Feedback {
  const isDrawing = p?.is_drawing !== false && p?.isDrawing !== false;
  // strength may be {en,ur}, a plain string, or the older praise {en:{title,text}} shape
  const sEn = str(p?.strength?.en ?? (typeof p?.strength === 'string' ? p.strength : undefined) ?? p?.praise?.en?.text, 'You worked hard on this drawing.');
  const sUr = str(p?.strength?.ur ?? p?.praise?.ur?.text, 'آپ نے اس تصویر پر بہت محنت کی۔');
  const tipsIn: any[] = Array.isArray(p?.tips) ? p.tips : [];
  const defaultSpots = [
    [0.25, 0.2],
    [0.62, 0.62],
    [0.4, 0.8],
  ];
  const tips: Tip[] = tipsIn.slice(0, 3).map((t, i) => {
    const area = AREA_ALIASES[String(t?.area || '').toLowerCase()] || SKILLS[i % 4];
    const en = t?.en && typeof t.en === 'object' ? t.en : { tip: t?.en ?? t?.tip ?? t?.text, why: t?.why };
    const ur = t?.ur && typeof t.ur === 'object' ? t.ur : { tip: t?.ur, why: undefined };
    const tipEn = str(en.tip, 'Keep practising this part.');
    const whyEn = str(en.why);
    return {
      area,
      x: clamp(t?.x, 0.05, 0.95, defaultSpots[i][0]),
      y: clamp(t?.y, 0.05, 0.95, defaultSpots[i][1]),
      en: tipEn,
      ur: str(ur.tip, tipEn),
      why: { en: whyEn, ur: str(ur.why, whyEn) },
    };
  });
  const s = p?.scores || {};
  const scores = {
    colour: toPercent(s.colour ?? s.color),
    light: toPercent(s.light),
    proportion: toPercent(s.proportion),
    composition: toPercent(s.composition),
  } as Scores;
  const ex = p?.exercise;
  const exEn = str(typeof ex === 'string' ? ex : ex?.en);
  return {
    isDrawing,
    subject: str(p?.subject, 'My drawing').slice(0, 40),
    praise: { en: { title: '', text: sEn }, ur: { title: '', text: sUr } },
    tips,
    scores,
    exercise: { en: exEn, ur: str(ex?.ur, exEn) },
  };
}

// ------------------------------------------------------------------ demo coach
const STRENGTHS: Bi[] = [
  { en: 'Great composition! Your shapes fill the page well and the picture feels balanced.', ur: 'بہترین ترتیب! آپ کی شکلیں صفحے کو اچھی طرح بھرتی ہیں اور تصویر متوازن لگتی ہے۔' },
  { en: 'Bold, happy colours! They make your drawing feel bright and cheerful.', ur: 'خوشگوار رنگ! یہ آپ کی تصویر کو روشن اور خوش باش بناتے ہیں۔' },
  { en: 'Confident lines! Your shapes are clear and strong. That shows real practice.', ur: 'پُراعتماد لکیریں! آپ کی شکلیں صاف اور مضبوط ہیں۔ یہ اصل مشق کی نشانی ہے۔' },
  { en: 'Lots of detail! You noticed small things that make your drawing fun to look at.', ur: 'بہت سی تفصیل! آپ نے چھوٹی چیزوں پر دھیان دیا جو تصویر کو دلچسپ بناتی ہیں۔' },
];
type BankTip = { en: string; ur: string; why: Bi };
const TIP_BANK: Record<Skill, BankTip[]> = {
  colour: [
    { en: 'Try a warm orange sky near the sun, fading to light blue at the top.', ur: 'سورج کے پاس آسمان گرم نارنجی بنائیں اور اوپر جا کر ہلکا نیلا کریں۔', why: { en: 'Warm colours make a sunny scene feel bright and alive.', ur: 'گرم رنگ دھوپ والے منظر کو روشن بناتے ہیں۔' } },
    { en: 'Use a lighter and a darker green to make the grass look real.', ur: 'گھاس کو اصلی دکھانے کے لیے ہلکا اور گہرا سبز رنگ استعمال کریں۔', why: { en: 'Real grass has many greens, so two shades add depth.', ur: 'اصلی گھاس میں کئی سبز رنگ ہوتے ہیں، دو رنگ گہرائی لاتے ہیں۔' } },
    { en: 'Pick one main colour and let the others support it.', ur: 'ایک اہم رنگ چنیں اور باقی رنگ اس کا ساتھ دیں۔', why: { en: 'One strong colour gives the picture a clear mood.', ur: 'ایک نمایاں رنگ تصویر کو واضح احساس دیتا ہے۔' } },
  ],
  light: [
    { en: 'Add a shadow on the side away from the sun.', ur: 'سورج سے دور والی طرف سایہ بنائیں۔', why: { en: 'Shadows make things look solid instead of flat.', ur: 'سائے چیزوں کو چپٹا نہیں بلکہ ٹھوس دکھاتے ہیں۔' } },
    { en: 'Leave a small white spot where the light hits.', ur: 'جہاں روشنی پڑتی ہے وہاں ایک چھوٹا سفید نشان چھوڑ دیں۔', why: { en: 'A highlight shows the shape is round and shiny.', ur: 'چمک کا نشان دکھاتا ہے کہ چیز گول اور چمکدار ہے۔' } },
    { en: 'Draw a soft shadow on the ground under each object.', ur: 'ہر چیز کے نیچے زمین پر ہلکا سا سایہ بنائیں۔', why: { en: 'Ground shadows stop things from looking like they float.', ur: 'زمین کے سائے چیزوں کو ہوا میں تیرتا ہوا نہیں دکھاتے۔' } },
  ],
  proportion: [
    { en: 'Make the door a little taller, about half the height of the wall.', ur: 'دروازہ تھوڑا لمبا کریں، دیوار کی آدھی اونچائی جتنا۔', why: { en: 'A door that fits a person makes the house look real.', ur: 'صحیح سائز کا دروازہ گھر کو اصلی دکھاتا ہے۔' } },
    { en: 'Draw things far away a little smaller.', ur: 'دور کی چیزیں تھوڑی چھوٹی بنائیں۔', why: { en: 'Smaller things look further away, which adds depth.', ur: 'چھوٹی چیزیں دور لگتی ہیں، اس سے گہرائی آتی ہے۔' } },
    { en: 'Compare sizes with your pencil before you draw.', ur: 'بنانے سے پہلے پنسل سے سائز کا موازنہ کریں۔', why: { en: 'Measuring helps everything fit together nicely.', ur: 'ناپنے سے ہر چیز اچھی طرح ایک ساتھ فٹ ہوتی ہے۔' } },
  ],
  composition: [
    { en: 'Move the main object a little away from the exact middle.', ur: 'اہم چیز کو بالکل بیچ سے تھوڑا ہٹا کر رکھیں۔', why: { en: 'Off-centre pictures feel more lively.', ur: 'بیچ سے ہٹی ہوئی تصویر زیادہ جاندار لگتی ہے۔' } },
    { en: 'Fill the empty corner with something small, like a bird.', ur: 'خالی کونے میں کوئی چھوٹی چیز بنائیں، جیسے ایک پرندہ۔', why: { en: 'It balances the page so the eye moves around it.', ur: 'اس سے صفحہ متوازن ہوتا ہے اور نظر پوری تصویر میں گھومتی ہے۔' } },
    { en: 'Let the ground line go all the way across the page.', ur: 'زمین کی لکیر کو پورے صفحے پر لے جائیں۔', why: { en: 'It makes the scene feel complete.', ur: 'اس سے منظر مکمل لگتا ہے۔' } },
  ],
};
const EXERCISES: Record<Skill, Bi> = {
  colour: { en: 'Draw the same tree twice: once with only warm colours, once with only cool colours. Which feels happier?', ur: 'ایک ہی درخت دو بار بنائیں: ایک بار صرف گرم رنگوں سے، ایک بار صرف ٹھنڈے رنگوں سے۔ کون سا زیادہ خوش لگتا ہے؟' },
  light: { en: 'Draw three balls on one page. Put the sun in a different place each time and shade the side away from the sun.', ur: 'ایک صفحے پر تین گیندیں بنائیں۔ ہر بار سورج الگ جگہ رکھیں اور سورج سے دور والی طرف سایہ کریں۔' },
  proportion: { en: 'Draw a person next to a door. Use your pencil to check the door is a bit taller than the person.', ur: 'دروازے کے ساتھ ایک انسان بنائیں۔ پنسل سے دیکھیں کہ دروازہ انسان سے تھوڑا اونچا ہو۔' },
  composition: { en: 'Split a page into 3 by 3 boxes. Draw a tree where two lines cross and a small bird on the other side.', ur: 'صفحے کو 3 ضرب 3 خانوں میں بانٹیں۔ جہاں دو لکیریں ملیں وہاں درخت بنائیں اور دوسری طرف چھوٹا پرندہ۔' },
};

function mockCoach(i: CoachInput): CoachResult {
  const h = crypto.createHash('sha256').update(i.image).digest();
  const scores = {
    colour: 20 * (2 + (h[0] % 3)),
    light: 20 * (1 + (h[1] % 4)),
    proportion: 20 * (2 + (h[2] % 3)),
    composition: 20 * (3 + (h[3] % 3)),
  } as Scores;
  const order = [...SKILLS].sort((a, b) => scores[a] - scores[b]);
  const spots = [
    [0.18, 0.18],
    [0.6, 0.62],
    [0.4, 0.82],
  ];
  const tips = order.slice(0, 3).map((area, n) => {
    const bank = TIP_BANK[area];
    const t = bank[h[4 + n] % bank.length];
    return { area, x: spots[n][0], y: spots[n][1], ...t };
  });
  const s = STRENGTHS[h[7] % STRENGTHS.length];
  return {
    isDrawing: true,
    subject: 'My drawing',
    praise: { en: { title: '', text: s.en }, ur: { title: '', text: s.ur } },
    tips,
    scores,
    exercise: EXERCISES[order[0]],
    provider: 'mock',
    model: 'demo-coach',
  };
}

// ------------------------------------------------------------------ entry
export async function analyseDrawing(i: CoachInput): Promise<CoachResult> {
  if (!aiIsReal()) return mockCoach(i);
  return callOpenAICompatible(i);
}

// 32x32 solid red PNG used to check the model can actually see images.
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGO4IydHU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAJI2YD1ZaHIvAAAAAElFTkSuQmCC';

/** Connectivity + vision check used by the admin panel. */
export async function testAi() {
  if (!aiIsReal()) return { ok: true, provider: 'mock', model: 'demo-coach', message: 'No AI_BASE_URL configured: the built-in demo coach is used.' };
  const started = Date.now();
  const out = (ok: boolean, message: string) => ({ ok, provider: 'openai', model: env.ai.model, message });
  try {
    const { content } = await chat(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: withNoThink('What single colour fills this image? Answer with one word.') },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${RED_PNG}` } },
          ],
        },
      ],
      { maxTokens: 300, timeoutMs: Math.min(env.ai.timeoutMs, 90000) },
    );
    const answer = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const ms = Date.now() - started;
    if (/red/i.test(answer)) return out(true, `Connected. The model can see images (answered "${answer.slice(0, 30)}") in ${(ms / 1000).toFixed(1)}s.`);
    return out(false, `Connected, but the model did not recognise a red test image (answered "${answer.slice(0, 80)}"). Make sure AI_MODEL is a vision (VL) model.`);
  } catch (e) {
    return out(false, (e as Error).message);
  }
}
