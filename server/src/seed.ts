/* Seeds the database: first admin, lessons, a monthly challenge and (optionally) demo accounts.
   Safe to run more than once. */
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { env } from './env.js';
import { addDays, dayKey, dayStartUtc } from './util.js';
import { evaluateBadges } from './services/badges.js';
import { ensureDailyChallenge } from './services/challenges.js';
import { saveFile } from './services/storage.js';

const LESSONS = [
  {
    slug: 'shade-a-ball', title: 'Shade a ball', titleUr: 'گیند پر سایہ بنائیں', category: 'light', durationMin: 5,
    summary: 'Turn a flat circle into a round ball with light and shadow.', summaryUr: 'روشنی اور سائے سے ایک چپٹے دائرے کو گول گیند بنائیں۔',
    steps: [
      { en: 'Draw a circle and put a small sun in the top corner', ur: 'ایک دائرہ بنائیں اور اوپر کونے میں چھوٹا سا سورج بنائیں' },
      { en: 'Shade the side away from the sun, darker at the edge', ur: 'سورج سے دور والی طرف سایہ کریں، کنارے پر زیادہ گہرا' },
      { en: 'Leave a small white spot where the light hits', ur: 'جہاں روشنی پڑتی ہے وہاں چھوٹا سفید نشان چھوڑیں' },
      { en: 'Add a soft shadow on the ground, away from the sun', ur: 'زمین پر سورج سے دور ہلکا سایہ بنائیں' },
    ],
  },
  {
    slug: 'warm-and-cool', title: 'Warm and cool colours', titleUr: 'گرم اور ٹھنڈے رنگ', category: 'colour', durationMin: 5,
    summary: 'Paint one sky warm and one sky cool and see how the mood changes.', summaryUr: 'ایک آسمان گرم اور ایک ٹھنڈے رنگ میں بنائیں اور فرق دیکھیں۔',
    steps: [
      { en: 'Draw two small boxes side by side with a simple hill in each', ur: 'دو چھوٹے خانے بنائیں اور ہر ایک میں ایک پہاڑی' },
      { en: 'Colour the first sky with yellow, orange and red', ur: 'پہلے آسمان میں پیلا، نارنجی اور لال رنگ بھریں' },
      { en: 'Colour the second sky with blue, green and purple', ur: 'دوسرے آسمان میں نیلا، سبز اور جامنی رنگ بھریں' },
      { en: 'Write one word under each: how does it feel?', ur: 'ہر ایک کے نیچے ایک لفظ لکھیں: یہ کیسا محسوس ہوتا ہے؟' },
    ],
  },
  {
    slug: 'face-proportions', title: 'Face proportions', titleUr: 'چہرے کے تناسب', category: 'proportion', durationMin: 8,
    summary: 'Where do eyes, nose and mouth really go? Use simple guide lines.', summaryUr: 'آنکھیں، ناک اور منہ اصل میں کہاں ہوتے ہیں؟ آسان لکیروں سے سیکھیں۔',
    steps: [
      { en: 'Draw an egg shape for the head', ur: 'سر کے لیے انڈے جیسی شکل بنائیں' },
      { en: 'Draw a light line across the middle: the eyes sit on it', ur: 'درمیان میں ہلکی لکیر کھینچیں: آنکھیں اس پر ہوتی ہیں' },
      { en: 'Halfway between eyes and chin, mark the bottom of the nose', ur: 'آنکھوں اور ٹھوڑی کے درمیان ناک کا نچلا حصہ لگائیں' },
      { en: 'Put the mouth one third of the way from nose to chin', ur: 'منہ کو ناک سے ٹھوڑی کے ایک تہائی فاصلے پر بنائیں' },
      { en: 'Ears go between the eye line and the nose line', ur: 'کان آنکھ اور ناک کی لکیروں کے درمیان ہوتے ہیں' },
    ],
  },
  {
    slug: 'rule-of-thirds', title: 'Rule of thirds', titleUr: 'تہائی کا اصول', category: 'composition', durationMin: 6,
    summary: 'Place your main object off-centre for a livelier picture.', summaryUr: 'اہم چیز کو درمیان سے ہٹا کر رکھیں تاکہ تصویر جاندار لگے۔',
    steps: [
      { en: 'Lightly divide your page into 3 by 3 boxes', ur: 'صفحے کو ہلکی لکیروں سے 3 ضرب 3 خانوں میں بانٹیں' },
      { en: 'Put the horizon on the top or bottom line, not the middle', ur: 'افق کو اوپر یا نیچے والی لکیر پر رکھیں، درمیان میں نہیں' },
      { en: 'Place your main object where two lines cross', ur: 'اہم چیز وہاں رکھیں جہاں دو لکیریں ملتی ہیں' },
      { en: 'Add one small object on the opposite side to balance it', ur: 'توازن کے لیے مخالف طرف ایک چھوٹی چیز بنائیں' },
    ],
  },
  {
    slug: 'animals-from-shapes', title: 'Animals from shapes', titleUr: 'شکلوں سے جانور', category: 'shapes', durationMin: 5,
    summary: 'Build a cat from circles, ovals and triangles.', summaryUr: 'دائروں، بیضوی اور تکونی شکلوں سے بلی بنائیں۔',
    steps: [
      { en: 'Draw a big oval for the body and a circle for the head', ur: 'جسم کے لیے بڑا بیضوی اور سر کے لیے دائرہ بنائیں' },
      { en: 'Add two triangles for ears', ur: 'کانوں کے لیے دو تکونیں بنائیں' },
      { en: 'Add a long curvy tail and four small ovals for paws', ur: 'لمبی مڑی ہوئی دم اور پنجوں کے لیے چار چھوٹے بیضوی بنائیں' },
      { en: 'Join the shapes with smooth lines and rub out the extras', ur: 'شکلوں کو ہموار لکیروں سے جوڑیں اور فالتو مٹا دیں' },
    ],
  },
  {
    slug: 'one-point-road', title: 'A road that goes far away', titleUr: 'دور جاتی سڑک', category: 'perspective', durationMin: 10,
    summary: 'Learn one-point perspective with a road and trees.', summaryUr: 'سڑک اور درختوں کے ساتھ ایک نقطہ تناظر سیکھیں۔',
    steps: [
      { en: 'Draw a horizon line and put one dot on it', ur: 'افق کی لکیر کھینچیں اور اس پر ایک نقطہ لگائیں' },
      { en: 'Draw two lines from the bottom corners to the dot: your road', ur: 'نیچے کے کونوں سے نقطے تک دو لکیریں: یہ آپ کی سڑک ہے' },
      { en: 'Draw trees along the road, smaller as they get closer to the dot', ur: 'سڑک کے ساتھ درخت بنائیں، نقطے کے قریب چھوٹے' },
      { en: 'Add road stripes that also get shorter and closer together', ur: 'سڑک کی پٹیاں بنائیں جو آگے جا کر چھوٹی ہوتی جائیں' },
    ],
  },
  {
    slug: 'mixing-greens', title: 'Mix ten greens', titleUr: 'دس قسم کا سبز', category: 'colour', durationMin: 8,
    summary: 'Real leaves are many greens. Mix your own palette.', summaryUr: 'اصلی پتے کئی طرح کے سبز ہوتے ہیں۔ اپنا رنگوں کا سیٹ بنائیں۔',
    steps: [
      { en: 'Make a row of 10 small squares', ur: '10 چھوٹے مربعوں کی ایک قطار بنائیں' },
      { en: 'Fill the first with pure green', ur: 'پہلے میں خالص سبز رنگ بھریں' },
      { en: 'Add a little yellow, then a little more, square by square', ur: 'ہر مربع میں تھوڑا تھوڑا پیلا ملاتے جائیں' },
      { en: 'In the last squares add a touch of blue or brown', ur: 'آخری مربعوں میں تھوڑا نیلا یا بھورا ملائیں' },
      { en: 'Use your new greens to colour a tree', ur: 'اپنے نئے سبز رنگوں سے ایک درخت بنائیں' },
    ],
  },
  {
    slug: 'cast-shadows', title: 'Shadows of a cube', titleUr: 'مکعب کا سایہ', category: 'light', durationMin: 10,
    summary: 'Three sides, three tones, one shadow.', summaryUr: 'تین اطراف، تین رنگت، ایک سایہ۔',
    steps: [
      { en: 'Draw a cube and decide where the light comes from', ur: 'ایک مکعب بنائیں اور طے کریں کہ روشنی کہاں سے آ رہی ہے' },
      { en: 'Keep the side facing the light the lightest', ur: 'روشنی والی طرف کو سب سے ہلکا رکھیں' },
      { en: 'Make one side medium and the far side darkest', ur: 'ایک طرف درمیانی اور دور والی طرف سب سے گہری کریں' },
      { en: 'Draw the shadow on the ground, stretching away from the light', ur: 'زمین پر روشنی سے دور پھیلتا سایہ بنائیں' },
    ],
  },
];

const HOUSE_GREY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" width="900" height="660"><rect width="300" height="220" fill="#FFFDF6"/><rect width="300" height="150" fill="#9AA5A8"/><circle cx="240" cy="48" r="24" fill="#F4B942"/><path d="M240 12v10M240 74v10M204 48h10M266 48h10" stroke="#E09A1E" stroke-width="4" stroke-linecap="round"/><path d="M0 150 C60 140 120 158 180 146 C230 136 270 150 300 144 L300 220 L0 220 Z" fill="#7BB662"/><rect x="70" y="95" width="100" height="80" fill="#E86A5A"/><path d="M58 97 L120 50 L182 97 Z" fill="#9B4636"/><rect x="108" y="135" width="24" height="40" fill="#6B4A2E"/><rect x="82" y="110" width="20" height="20" fill="#CFE3EC" stroke="#1D2B2E" stroke-width="2"/><rect x="216" y="120" width="10" height="55" fill="#7A5230"/><circle cx="221" cy="110" r="26" fill="#4E9A4A"/></svg>`;
const HOUSE_WARM = HOUSE_GREY.replace('fill="#9AA5A8"', 'fill="#F7B267"').replace('<path d="M58', '<rect x="148" y="95" width="22" height="80" fill="#1D2B2E" opacity="0.22"/><ellipse cx="190" cy="178" rx="36" ry="6" fill="#1D2B2E" opacity="0.15"/><path d="M58');
const FLOWER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="800" height="800"><rect width="100" height="100" fill="#FFFDF6"/><path d="M50 50v40" stroke="#4E9A4A" stroke-width="4"/><circle cx="50" cy="32" r="10" fill="#E86A5A"/><circle cx="36" cy="42" r="10" fill="#E86A5A"/><circle cx="64" cy="42" r="10" fill="#E86A5A"/><circle cx="50" cy="44" r="8" fill="#F4B942"/></svg>`;
const CAT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="800" height="800"><rect width="100" height="100" fill="#E7F0F7"/><circle cx="50" cy="56" r="24" fill="#8C6BC8"/><path d="M30 42 L32 22 L46 34 Z M70 42 L68 22 L54 34 Z" fill="#8C6BC8"/><circle cx="42" cy="54" r="3" fill="#1D2B2E"/><circle cx="58" cy="54" r="3" fill="#1D2B2E"/></svg>`;

const DEMO_DRAWINGS = [
  {
    svg: HOUSE_GREY, title: 'House', daysAgo: 20,
    praise: { en: { title: '', text: 'Great composition! Your house and tree balance each other nicely, and the sun is in just the right spot.' }, ur: { title: '', text: 'بہترین ترتیب! گھر اور درخت ایک دوسرے کا توازن بناتے ہیں اور سورج بالکل صحیح جگہ پر ہے۔' } },
    tips: [
      { area: 'colour', x: 0.18, y: 0.18, en: 'Try a warm orange sky near the sun, fading to light blue at the top.', ur: 'سورج کے پاس آسمان گرم نارنجی بنائیں اور اوپر جا کر ہلکا نیلا کریں۔', why: { en: 'Warm colours make a sunny scene feel bright and alive.', ur: 'گرم رنگ دھوپ والے منظر کو روشن بناتے ہیں۔' } },
      { area: 'light', x: 0.6, y: 0.62, en: 'Add a shadow on the right side of the house and tree.', ur: 'گھر اور درخت کی دائیں طرف سایہ بنائیں۔', why: { en: 'The sun is on the right, so shadows fall the other way. This makes things look solid.', ur: 'سایہ سورج سے الٹی طرف پڑتا ہے۔ اس سے چیزیں ٹھوس لگتی ہیں۔' } },
      { area: 'proportion', x: 0.42, y: 0.78, en: 'Make the door a little taller, about half the height of the wall.', ur: 'دروازہ تھوڑا لمبا کریں، دیوار کی آدھی اونچائی جتنا۔', why: { en: 'A door that fits a person makes the house look real.', ur: 'صحیح سائز کا دروازہ گھر کو اصلی دکھاتا ہے۔' } },
    ],
    scores: { colour: 60, light: 40, proportion: 60, composition: 80 },
    exercise: { en: 'Draw three balls on one page. Put the sun in a different place each time and shade the side away from the sun.', ur: 'ایک صفحے پر تین گیندیں بنائیں۔ ہر بار سورج الگ جگہ رکھیں اور سورج سے دور والی طرف سایہ کریں۔' },
  },
  {
    svg: FLOWER, title: 'Flower', daysAgo: 9,
    praise: { en: { title: '', text: 'Bold, happy colours! The red petals and yellow middle really stand out.' }, ur: { title: '', text: 'خوشگوار رنگ! لال پنکھڑیاں اور پیلا درمیان بہت نمایاں ہیں۔' } },
    tips: [
      { area: 'proportion', x: 0.5, y: 0.75, en: 'Make the stem a little thicker so it can hold the flower.', ur: 'تنا تھوڑا موٹا بنائیں تاکہ وہ پھول کو تھام سکے۔', why: { en: 'A strong stem makes the flower look like it can stand up.', ur: 'مضبوط تنا پھول کو کھڑا ہوا دکھاتا ہے۔' } },
      { area: 'composition', x: 0.8, y: 0.2, en: 'Add a leaf or a bee to fill the empty space.', ur: 'خالی جگہ بھرنے کے لیے ایک پتا یا شہد کی مکھی بنائیں۔', why: { en: 'It balances the page so the eye moves around it.', ur: 'اس سے صفحہ متوازن ہوتا ہے۔' } },
      { area: 'light', x: 0.62, y: 0.4, en: 'Make one side of each petal a little darker.', ur: 'ہر پنکھڑی کی ایک طرف تھوڑی گہری کریں۔', why: { en: 'Darker sides make the petals look round, not flat.', ur: 'گہری طرف پنکھڑیوں کو گول دکھاتی ہے۔' } },
    ],
    scores: { colour: 80, light: 40, proportion: 60, composition: 60 },
    exercise: { en: 'Draw five petals and shade only the side of each one that is away from the sun.', ur: 'پانچ پنکھڑیاں بنائیں اور ہر ایک کی صرف سورج سے دور والی طرف سایہ کریں۔' },
  },
  {
    svg: CAT, title: 'Cat', daysAgo: 4,
    praise: { en: { title: '', text: 'Confident shapes! You built the cat from clear circles and triangles.' }, ur: { title: '', text: 'پُراعتماد شکلیں! آپ نے بلی کو صاف دائروں اور تکونوں سے بنایا۔' } },
    tips: [
      { area: 'light', x: 0.7, y: 0.6, en: 'Shade one side of the body a little darker.', ur: 'جسم کی ایک طرف تھوڑا گہرا سایہ کریں۔', why: { en: 'Shading makes the cat look round and soft.', ur: 'سایہ بلی کو گول اور نرم دکھاتا ہے۔' } },
      { area: 'proportion', x: 0.5, y: 0.3, en: 'Make the ears a bit smaller than half the head.', ur: 'کان سر کے آدھے سے تھوڑے چھوٹے بنائیں۔', why: { en: 'Smaller ears look more like a real cat.', ur: 'چھوٹے کان اصلی بلی جیسے لگتے ہیں۔' } },
      { area: 'composition', x: 0.2, y: 0.8, en: 'Add a ground line and a toy so the cat is not floating.', ur: 'زمین کی لکیر اور ایک کھلونا بنائیں تاکہ بلی ہوا میں نہ لگے۔', why: { en: 'A setting tells a little story.', ur: 'منظر ایک چھوٹی سی کہانی سناتا ہے۔' } },
    ],
    scores: { colour: 80, light: 60, proportion: 60, composition: 80 },
    exercise: { en: 'Draw a cat from shapes: a big oval, a circle and two triangles. Shade the side away from the window.', ur: 'شکلوں سے بلی بنائیں: ایک بڑا بیضوی، ایک دائرہ اور دو تکونیں۔ کھڑکی سے دور والی طرف سایہ کریں۔' },
  },
  {
    svg: HOUSE_WARM, title: 'House (again)', daysAgo: 0,
    praise: { en: { title: '', text: 'Look at that sky! The warm orange sky and the shadow make your house look real. Nice work!' }, ur: { title: '', text: 'کیا آسمان ہے! گرم نارنجی آسمان اور سایہ آپ کے گھر کو اصلی دکھاتے ہیں۔ شاباش!' } },
    tips: [
      { area: 'colour', x: 0.3, y: 0.72, en: 'Try two greens in the grass, lighter at the front.', ur: 'گھاس میں دو سبز رنگ آزمائیں، آگے ہلکا۔', why: { en: 'Two shades add depth to the ground.', ur: 'دو رنگ زمین میں گہرائی لاتے ہیں۔' } },
      { area: 'composition', x: 0.12, y: 0.4, en: 'A small bird in the sky would balance the tree.', ur: 'آسمان میں چھوٹا پرندہ درخت کا توازن بنائے گا۔', why: { en: 'It fills the empty side so the picture feels even.', ur: 'یہ خالی طرف بھرتا ہے اور تصویر برابر لگتی ہے۔' } },
      { area: 'proportion', x: 0.42, y: 0.78, en: 'Make the door a little taller.', ur: 'دروازہ تھوڑا لمبا کریں۔', why: { en: 'A door that fits a person makes the house look real.', ur: 'صحیح سائز کا دروازہ گھر کو اصلی دکھاتا ہے۔' } },
    ],
    scores: { colour: 80, light: 60, proportion: 60, composition: 100 },
    exercise: { en: 'Draw a door next to a stick person. The door should be a little taller than the person.', ur: 'ایک تنکا آدمی کے ساتھ دروازہ بنائیں۔ دروازہ آدمی سے تھوڑا اونچا ہونا چاہیے۔' },
  },
];

async function upsertUser(data: { email?: string; username?: string; role: string; name: string; password: string; birthYear?: number; parentId?: string; language?: string; phone?: string }) {
  const where = data.email ? { email: data.email } : { username: data.username! };
  const found = await prisma.user.findUnique({ where });
  if (found) return found;
  const { password, ...rest } = data;
  return prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) } });
}

async function main() {
  // 1. admin
  const admin = await upsertUser({ email: env.admin.email.toLowerCase(), role: 'admin', name: env.admin.name, password: env.admin.password });
  console.log(`✓ admin: ${admin.email}`);

  // 2. lessons
  for (const [i, l] of LESSONS.entries()) {
    const data = { ...l, steps: JSON.stringify(l.steps), sortOrder: i, published: true };
    await prisma.lesson.upsert({ where: { slug: l.slug }, update: {}, create: data });
  }
  console.log(`✓ ${LESSONS.length} lessons`);

  // 3. challenge for the current month
  const today = dayKey();
  const monthStart = today.slice(0, 8) + '01';
  const [y, m] = monthStart.split('-').map(Number);
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  const monthName = new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en', { month: 'long' });
  const existing = await prisma.challenge.findFirst({ where: { startsAt: dayStartUtc(monthStart) } });
  if (!existing) {
    await prisma.challenge.create({
      data: {
        title: `${monthName}: My favourite place`,
        titleUr: 'میری پسندیدہ جگہ',
        description: 'Draw it, snap it, share it with your art class. Prizes from local art shops.',
        descriptionUr: 'اسے بنائیں، تصویر لیں اور اپنی آرٹ کلاس کے ساتھ شیئر کریں۔ مقامی آرٹ کی دکانوں سے انعامات۔',
        prize: 'Art supplies from local art shops',
        startsAt: dayStartUtc(monthStart),
        endsAt: new Date(dayStartUtc(nextMonth).getTime() - 1000),
        active: true,
      },
    });
  }
  console.log('✓ monthly challenge');
  await ensureDailyChallenge();
  console.log("✓ today's challenge");

  if (!env.seedDemo) return;

  // 4. demo accounts
  const year = new Date().getFullYear();
  const parent = await upsertUser({ email: 'parent@demo.pk', role: 'parent', name: 'Sana Khan', password: 'demo1234', phone: '0300-1234567' });
  const child = await upsertUser({ username: 'ayesha', role: 'student', name: 'Ayesha', password: 'demo1234', birthYear: year - 11, parentId: parent.id });
  const teen = await upsertUser({ email: 'teen@demo.pk', role: 'student', name: 'Bilal', password: 'demo1234', birthYear: year - 15 });

  // update demo drawings created by an older version of this seed to the new feedback format
  for (const [i, d] of DEMO_DRAWINGS.entries()) {
    await prisma.drawing.updateMany({
      where: { userId: child.id, imagePath: { contains: `/demo-${i}` } },
      data: { praise: JSON.stringify(d.praise), tips: JSON.stringify(d.tips), scores: JSON.stringify(d.scores), exercise: JSON.stringify(d.exercise) },
    });
  }

  if ((await prisma.drawing.count({ where: { userId: child.id } })) === 0) {
    for (const [i, d] of DEMO_DRAWINGS.entries()) {
      const rel = await saveFile(`${child.id}/demo-${i}.svg`, Buffer.from(d.svg), 'image/svg+xml');
      const when = new Date(Date.now() - d.daysAgo * 86400000 - 3600000);
      await prisma.drawing.create({
        data: {
          userId: child.id, title: d.title, imagePath: rel, mime: 'image/svg+xml', status: 'done', provider: 'mock', model: 'demo-coach',
          praise: JSON.stringify(d.praise), tips: JSON.stringify(d.tips), scores: JSON.stringify(d.scores), exercise: JSON.stringify(d.exercise), createdAt: when, analyzedAt: when,
        },
      });
    }
    // a little practice history: a streak of the last 5 days
    const ball = await prisma.lesson.findUnique({ where: { slug: 'shade-a-ball' } });
    const shapes = await prisma.lesson.findUnique({ where: { slug: 'animals-from-shapes' } });
    for (let i = 1; i <= 4; i++) {
      const lesson = i % 2 ? ball! : shapes!;
      await prisma.practiceSession.create({
        data: { userId: child.id, lessonId: lesson.id, stepsDone: 4, stepsTotal: 4, secondsSpent: 300, completed: true, createdAt: new Date(Date.now() - i * 86400000) },
      });
      await prisma.dailyActivity.upsert({
        where: { userId_day: { userId: child.id, day: addDays(today, -i) } },
        update: {},
        create: { userId: child.id, day: addDays(today, -i), minutes: 7 },
      });
    }
    await evaluateBadges(child.id);

  }
  console.log('✓ demo accounts:');
  console.log('    parent   parent@demo.pk / demo1234');
  console.log('    child    ayesha / demo1234   (under 13, linked to parent)');
  console.log('    teen     teen@demo.pk / demo1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
