import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { addDays, dayDiff, dayKey, dayStartUtc, safeJson, weekStart } from '../util.js';

export const SKILLS = ['colour', 'light', 'proportion', 'composition'] as const;
export type Skill = (typeof SKILLS)[number];
export type Scores = Record<Skill, number>;

/** Set of YYYY-MM-DD days the student did something (a drawing or a practice). */
async function activeDays(userId: string, sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 86400000);
  const [d, p] = await Promise.all([
    prisma.drawing.findMany({ where: { userId, createdAt: { gte: since }, status: 'done' }, select: { createdAt: true } }),
    prisma.practiceSession.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);
  return new Set([...d, ...p].map((x) => dayKey(x.createdAt)));
}

/** Consecutive days of activity ending today (or yesterday, so a streak is not lost before you draw today). */
export async function streak(userId: string) {
  const days = await activeDays(userId);
  let cur = dayKey();
  if (!days.has(cur)) cur = addDays(cur, -1);
  let n = 0;
  while (days.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

/** Drawings per week for the last `n` weeks (oldest first). */
export async function weeklyCounts(userId: string, n = 4) {
  const thisWeek = weekStart(dayKey());
  const starts = Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (n - 1 - i)));
  const drawings = await prisma.drawing.findMany({
    where: { userId, status: 'done', createdAt: { gte: dayStartUtc(starts[0]) } },
    select: { createdAt: true },
  });
  const counts = starts.map(() => 0);
  for (const d of drawings) {
    const idx = Math.floor(dayDiff(starts[0], dayKey(d.createdAt)) / 7);
    if (idx >= 0 && idx < n) counts[idx]++;
  }
  return starts.map((start, i) => ({ start, count: counts[i] }));
}

/** Average of the last 5 analysed drawings per skill. */
export async function skillLevels(userId: string) {
  const recent = await prisma.drawing.findMany({
    where: { userId, status: 'done' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { scores: true },
  });
  const out = {} as Scores;
  for (const k of SKILLS) {
    const vals = recent.map((r) => safeJson<Partial<Scores>>(r.scores, {})[k]).filter((v): v is number => typeof v === 'number');
    out[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  return { scores: out, basedOn: recent.length };
}

export async function minutesToday(userId: string) {
  const row = await prisma.dailyActivity.findUnique({ where: { userId_day: { userId, day: dayKey() } } });
  return row?.minutes || 0;
}

export async function timeLimitReached(user: User) {
  if (user.role !== 'student' || !user.dailyLimitOn) return false;
  return (await minutesToday(user.id)) >= user.dailyLimitMin;
}

/** Summary used by the parent dashboard: this week's drawings and minutes. */
export async function weekSummary(userId: string) {
  const start = weekStart(dayKey());
  const [drawings, practices, activity] = await Promise.all([
    prisma.drawing.count({ where: { userId, status: 'done', createdAt: { gte: dayStartUtc(start) } } }),
    prisma.practiceSession.count({ where: { userId, createdAt: { gte: dayStartUtc(start) } } }),
    prisma.dailyActivity.findMany({ where: { userId, day: { gte: start } } }),
  ]);
  return { drawings, practices, minutes: activity.reduce((a, r) => a + r.minutes, 0) };
}
