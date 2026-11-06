import { prisma } from '../db.js';
import { addDays, dayDiff, dayKey, dayStartUtc } from '../util.js';
import { getSettings } from './settings.js';

/** Rotating pool for the automatic "Today's challenge". Admins can still create their own. */
const DAILY_POOL = [
  { title: 'Draw a sunset over the Bagh hills', titleUr: 'باغ کی پہاڑیوں پر غروبِ آفتاب بنائیں', description: 'Use at least three warm colours in the sky.', descriptionUr: 'آسمان میں کم از کم تین گرم رنگ استعمال کریں۔' },
  { title: 'Draw your favourite fruit', titleUr: 'اپنا پسندیدہ پھل بنائیں', description: 'Shade the side away from the light so it looks round.', descriptionUr: 'روشنی سے دور والی طرف سایہ کریں تاکہ وہ گول لگے۔' },
  { title: 'Draw a cup of chai', titleUr: 'چائے کا کپ بنائیں', description: 'Add a shadow on the table under the cup.', descriptionUr: 'کپ کے نیچے میز پر سایہ بنائیں۔' },
  { title: 'Draw your school bag', titleUr: 'اپنا اسکول بیگ بنائیں', description: 'Look carefully: how tall is it compared to how wide?', descriptionUr: 'غور سے دیکھیں: یہ چوڑائی کے مقابلے میں کتنا اونچا ہے؟' },
  { title: 'Draw a tree from your window', titleUr: 'کھڑکی سے نظر آنے والا درخت بنائیں', description: 'Use at least two different greens for the leaves.', descriptionUr: 'پتوں کے لیے کم از کم دو مختلف سبز رنگ استعمال کریں۔' },
  { title: 'Draw a cat or a bird', titleUr: 'بلی یا پرندہ بنائیں', description: 'Start with simple shapes: circles, ovals and triangles.', descriptionUr: 'آسان شکلوں سے شروع کریں: دائرے، بیضوی اور تکونیں۔' },
  { title: 'Draw a road going far away', titleUr: 'دور جاتی سڑک بنائیں', description: 'Make things smaller as they get further away.', descriptionUr: 'جو چیزیں دور ہوں انہیں چھوٹا بنائیں۔' },
  { title: 'Draw a truck with patterns', titleUr: 'نقش و نگار والا ٹرک بنائیں', description: 'Decorate it with bright colours, like a real Pakistani truck.', descriptionUr: 'اسے اصلی پاکستانی ٹرک کی طرح چمکدار رنگوں سے سجائیں۔' },
  { title: 'Draw your family at dinner', titleUr: 'کھانے پر اپنی فیملی بنائیں', description: 'Put the most important person off-centre.', descriptionUr: 'سب سے اہم شخص کو بالکل بیچ میں نہ رکھیں۔' },
  { title: 'Draw a rainy day', titleUr: 'بارش کا دن بنائیں', description: 'Use cool colours: blues, greys and purples.', descriptionUr: 'ٹھنڈے رنگ استعمال کریں: نیلا، سرمئی اور جامنی۔' },
];

let lastChecked = '';

/** Makes sure there is a challenge for today (one per day, rotating through the pool). Cheap to call often. */
export async function ensureDailyChallenge() {
  const today = dayKey();
  if (lastChecked === today) return;
  const s = await getSettings();
  if (!s.autoDailyChallenge) {
    lastChecked = today;
    return;
  }
  const start = dayStartUtc(today);
  const end = new Date(dayStartUtc(addDays(today, 1)).getTime() - 1000);
  const existing = await prisma.challenge.findFirst({ where: { startsAt: { lte: start }, endsAt: { gte: end, lte: new Date(end.getTime() + 36 * 3600 * 1000) } } });
  if (!existing) {
    const pick = DAILY_POOL[Math.abs(dayDiff('2026-01-01', today)) % DAILY_POOL.length];
    await prisma.challenge.create({ data: { ...pick, prize: null, startsAt: start, endsAt: end, active: true } });
  }
  lastChecked = today;
}
