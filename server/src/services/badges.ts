import { prisma } from '../db.js';
import { safeJson } from '../util.js';
import { notify } from './notify.js';
import { streak } from './stats.js';

export const BADGES = [
  { code: 'first_snap', name: 'First snap', nameUr: 'پہلی تصویر', color: '#F4B942', icon: 'camera', hint: 'Get feedback on your first drawing' },
  { code: 'streak_5', name: '5-day streak', nameUr: '5 دن مسلسل', color: '#E86A5A', icon: 'flame', hint: 'Draw or practise 5 days in a row' },
  { code: 'shading_starter', name: 'Shading starter', nameUr: 'سایہ سازی کا آغاز', color: '#8C6BC8', icon: 'ball', hint: 'Finish a light and shadow lesson' },
  { code: 'colour_explorer', name: 'Colour explorer', nameUr: 'رنگوں کا کھوجی', color: '#4E9A4A', icon: 'palette', hint: '5 drawings with good colour' },
  { code: 'challenge_artist', name: 'Challenge artist', nameUr: 'چیلنج آرٹسٹ', color: '#13707F', icon: 'trophy', hint: 'Enter a monthly challenge' },
  { code: 'practices_10', name: '10 practices', nameUr: '10 مشقیں', color: '#C0473A', icon: 'pencil', hint: 'Finish 10 practice lessons' },
] as const;

export type BadgeCode = (typeof BADGES)[number]['code'];

/** Checks every badge rule and awards any newly earned ones. Returns the new badge codes. */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const owned = new Set((await prisma.userBadge.findMany({ where: { userId } })).map((b) => b.code));
  const missing = BADGES.filter((b) => !owned.has(b.code));
  if (!missing.length) return [];

  const earned: string[] = [];
  for (const b of missing) {
    let ok = false;
    switch (b.code) {
      case 'first_snap':
        ok = (await prisma.drawing.count({ where: { userId, status: 'done' } })) >= 1;
        break;
      case 'streak_5':
        ok = (await streak(userId)) >= 5;
        break;
      case 'shading_starter':
        ok = (await prisma.practiceSession.count({ where: { userId, completed: true, lesson: { category: 'light' } } })) >= 1;
        break;
      case 'colour_explorer': {
        const ds = await prisma.drawing.findMany({ where: { userId, status: 'done' }, select: { scores: true } });
        ok = ds.filter((d) => (safeJson<{ colour?: number }>(d.scores, {}).colour ?? 0) >= 70).length >= 5;
        break;
      }
      case 'challenge_artist':
        ok = (await prisma.challengeEntry.count({ where: { userId, drawingId: { not: null } } })) >= 1;
        break;
      case 'practices_10':
        ok = (await prisma.practiceSession.count({ where: { userId, completed: true } })) >= 10;
        break;
    }
    if (ok) earned.push(b.code);
  }

  for (const code of earned) {
    await prisma.userBadge.upsert({ where: { userId_code: { userId, code } }, update: {}, create: { userId, code } });
    const b = BADGES.find((x) => x.code === code)!;
    await notify(userId, `New badge: ${b.name}`, 'Well done! See it on your progress page.', '/app/progress');
  }
  return earned;
}
