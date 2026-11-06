import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { canViewStudent, requireAuth, resolveStudentId } from '../auth.js';
import { ah, dayKey, dayStartUtc, HttpError, parse, safeJson, weekStart } from '../util.js';
import { BADGES, evaluateBadges } from '../services/badges.js';
import { enqueueAnalysis, imageFile, serializeDrawing } from '../services/drawings.js';
import { ensureDailyChallenge } from '../services/challenges.js';
import { skillLevels, streak, timeLimitReached, weeklyCounts, SKILLS, type Scores } from '../services/stats.js';

export const studentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Please upload a JPG, PNG or WebP photo.'));
  },
});

// ------------------------------------------------------------------ lessons helpers
function serializeLesson(l: { id: string; slug: string; title: string; titleUr: string | null; category: string; summary: string; summaryUr: string | null; durationMin: number; steps: string }, completed = false) {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    titleUr: l.titleUr,
    category: l.category,
    summary: l.summary,
    summaryUr: l.summaryUr,
    durationMin: l.durationMin,
    completed,
    steps: safeJson<{ en: string; ur?: string }[]>(l.steps, []),
    stepCount: safeJson<unknown[]>(l.steps, []).length,
  };
}

const SKILL_TO_CATEGORY: Record<string, string> = { colour: 'colour', light: 'light', proportion: 'proportion', composition: 'composition' };

/** Suggest a lesson for the student's weakest skill (falls back to the first unlocked lesson). */
async function suggestedLesson(userId: string, weakest?: string) {
  const lessons = await prisma.lesson.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  const doneIds = new Set((await prisma.practiceSession.findMany({ where: { userId, completed: true }, select: { lessonId: true } })).map((s) => s.lessonId));
  const usable = lessons;
  const cat = weakest ? SKILL_TO_CATEGORY[weakest] : undefined;
  const pick =
    usable.find((l) => l.category === cat && !doneIds.has(l.id)) ||
    usable.find((l) => !doneIds.has(l.id)) ||
    usable.find((l) => l.category === cat) ||
    usable[0];
  return pick ? serializeLesson(pick, doneIds.has(pick.id)) : null;
}

function weakestSkill(scores: Scores | null) {
  if (!scores) return undefined;
  return [...SKILLS].sort((a, b) => scores[a] - scores[b])[0];
}

// ------------------------------------------------------------------ home
studentRouter.get(
  '/home',
  requireAuth('student'),
  ah(async (req, res) => {
    const u = req.user!;
    await ensureDailyChallenge();
    const now = new Date();
    const [streakDays, recent, challenge, skills] = await Promise.all([
      streak(u.id),
      prisma.drawing.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 6 }),
      prisma.challenge.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { endsAt: 'asc' } }),
      skillLevels(u.id),
    ]);
    const entry = challenge ? await prisma.challengeEntry.findUnique({ where: { challengeId_userId: { challengeId: challenge.id, userId: u.id } } }) : null;

    // "Your week" card
    const weekFrom = dayStartUtc(weekStart(dayKey()));
    const [weekDrawings, weekLessons, badges] = await Promise.all([
      prisma.drawing.findMany({ where: { userId: u.id, status: 'done', createdAt: { gte: weekFrom } }, select: { tips: true } }),
      prisma.practiceSession.count({ where: { userId: u.id, createdAt: { gte: weekFrom } } }),
      prisma.userBadge.count({ where: { userId: u.id } }),
    ]);
    const week = {
      drawings: weekDrawings.length,
      tips: weekDrawings.reduce((n, d) => n + safeJson<unknown[]>(d.tips, []).length, 0),
      lessons: weekLessons,
      badges,
    };
    // label the challenge by how long it runs
    const span = challenge ? challenge.endsAt.getTime() - challenge.startsAt.getTime() : 0;
    const period = span <= 36 * 3600 * 1000 ? 'day' : span <= 8 * 86400 * 1000 ? 'week' : 'month';

    res.json({
      week,
      streak: streakDays,
      todaysLesson: await suggestedLesson(u.id, skills.basedOn ? weakestSkill(skills.scores) : undefined),
      challenge: challenge ? { ...challenge, period, joined: !!entry, submitted: !!entry?.drawingId } : null,
      drawings: recent.map(serializeDrawing),
    });
  }),
);

// ------------------------------------------------------------------ drawings
studentRouter.post(
  '/drawings',
  requireAuth('student'),
  upload.single('image'),
  ah(async (req, res) => {
    const u = req.user!;
    if (!req.file) throw new HttpError(400, 'Please add a photo of your drawing.');
    if (await timeLimitReached(u)) throw new HttpError(403, "That's enough screen time for today. See you tomorrow!", 'time_limit');
    const body = parse(z.object({ mode: z.enum(['paper', 'screen']).default('paper'), title: z.string().trim().max(40).optional() }), req.body);
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const rel = `${u.id}/${crypto.randomUUID()}.${ext}`;
    await fs.mkdir(path.join(env.uploadDir, u.id), { recursive: true });
    await fs.writeFile(path.join(env.uploadDir, rel), req.file.buffer);
    const d = await prisma.drawing.create({
      data: { userId: u.id, mode: body.mode, title: body.title || 'My drawing', imagePath: rel, mime: req.file.mimetype },
    });
    enqueueAnalysis(d.id);
    res.status(201).json({ drawing: serializeDrawing(d) });
  }),
);

studentRouter.get(
  '/drawings',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const userId = await resolveStudentId(req);
    const list = await prisma.drawing.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ drawings: list.map(serializeDrawing) });
  }),
);

async function loadDrawingFor(reqUser: Express.Request['user'], id: string) {
  const d = await prisma.drawing.findUnique({ where: { id } });
  if (!d || !(await canViewStudent(reqUser!, d.userId))) throw new HttpError(404, 'Drawing not found.');
  return d;
}

studentRouter.get(
  '/drawings/:id',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const d = await loadDrawingFor(req.user, req.params.id);
    const now = new Date();
    const challenge = await prisma.challenge.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } });
    const entry = challenge ? await prisma.challengeEntry.findUnique({ where: { challengeId_userId: { challengeId: challenge.id, userId: d.userId } } }) : null;
    const owner = await prisma.user.findUnique({ where: { id: d.userId } });
    const scores = safeJson<Scores | null>(d.scores, null);
    res.json({
      drawing: serializeDrawing(d),
      suggestedLesson: owner ? await suggestedLesson(owner.id, weakestSkill(scores)) : null,
      challenge: challenge && entry ? { id: challenge.id, title: challenge.title, submittedDrawingId: entry.drawingId } : null,
    });
  }),
);

studentRouter.get(
  '/drawings/:id/image',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const d = await loadDrawingFor(req.user, req.params.id);
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    res.type(d.mime).sendFile(imageFile(d));
  }),
);

studentRouter.patch(
  '/drawings/:id',
  requireAuth('student'),
  ah(async (req, res) => {
    const d = await loadDrawingFor(req.user, req.params.id);
    if (d.userId !== req.user!.id) throw new HttpError(403, 'Only the artist can rename this.');
    const { title } = parse(z.object({ title: z.string().trim().min(1).max(40) }), req.body);
    const out = await prisma.drawing.update({ where: { id: d.id }, data: { title } });
    res.json({ drawing: serializeDrawing(out) });
  }),
);

studentRouter.post(
  '/drawings/:id/retry',
  requireAuth('student'),
  ah(async (req, res) => {
    const d = await loadDrawingFor(req.user, req.params.id);
    if (d.userId !== req.user!.id) throw new HttpError(403, 'Not allowed.');
    if (d.status !== 'failed') throw new HttpError(400, 'This drawing does not need a retry.');
    const out = await prisma.drawing.update({ where: { id: d.id }, data: { status: 'processing', error: null } });
    enqueueAnalysis(d.id);
    res.json({ drawing: serializeDrawing(out) });
  }),
);

studentRouter.delete(
  '/drawings/:id',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const d = await loadDrawingFor(req.user, req.params.id);
    await prisma.drawing.delete({ where: { id: d.id } });
    await fs.rm(imageFile(d), { force: true });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ lessons & practice
studentRouter.get(
  '/lessons',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const u = req.user!;
    const lessons = await prisma.lesson.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
    const done = new Set((await prisma.practiceSession.findMany({ where: { userId: u.id, completed: true }, select: { lessonId: true } })).map((s) => s.lessonId));
    res.json({ lessons: lessons.map((l) => serializeLesson(l, done.has(l.id))) });
  }),
);

studentRouter.get(
  '/lessons/:slug',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const l = await prisma.lesson.findFirst({ where: { slug: req.params.slug, published: true } });
    if (!l) throw new HttpError(404, 'Lesson not found.');
    const completed = !!(await prisma.practiceSession.findFirst({ where: { userId: req.user!.id, lessonId: l.id, completed: true } }));
    res.json({ lesson: serializeLesson(l, completed) });
  }),
);

studentRouter.post(
  '/practice',
  requireAuth('student'),
  ah(async (req, res) => {
    const body = parse(z.object({ lessonId: z.string(), stepsDone: z.number().int().min(0), seconds: z.number().int().min(0).max(4 * 3600) }), req.body);
    const l = await prisma.lesson.findUnique({ where: { id: body.lessonId } });
    if (!l) throw new HttpError(404, 'Lesson not found.');
    const total = safeJson<unknown[]>(l.steps, []).length;
    const stepsDone = Math.min(body.stepsDone, total);
    await prisma.practiceSession.create({
      data: { userId: req.user!.id, lessonId: l.id, stepsDone, stepsTotal: total, secondsSpent: body.seconds, completed: stepsDone >= total },
    });
    const newBadges = await evaluateBadges(req.user!.id);
    res.status(201).json({ ok: true, newBadges });
  }),
);

// ------------------------------------------------------------------ progress
studentRouter.get(
  '/progress',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const userId = await resolveStudentId(req);
    const [weeks, skills, owned, total, first, latest, practices, streakDays, student] = await Promise.all([
      weeklyCounts(userId, 4),
      skillLevels(userId),
      prisma.userBadge.findMany({ where: { userId } }),
      prisma.drawing.count({ where: { userId, status: 'done' } }),
      prisma.drawing.findFirst({ where: { userId, status: 'done' }, orderBy: { createdAt: 'asc' } }),
      prisma.drawing.findFirst({ where: { userId, status: 'done' }, orderBy: { createdAt: 'desc' } }),
      prisma.practiceSession.count({ where: { userId, completed: true } }),
      streak(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, createdAt: true } }),
    ]);
    const ownedMap = new Map(owned.map((b) => [b.code, b.earnedAt]));
    const weeksSince = student ? Math.max(1, Math.ceil((Date.now() - student.createdAt.getTime()) / (7 * 86400000))) : 1;
    res.json({
      name: student?.name,
      totalDrawings: total,
      practices,
      streak: streakDays,
      weeksActive: weeksSince,
      weeks,
      skills,
      badges: BADGES.map((b) => ({ ...b, earned: ownedMap.has(b.code), earnedAt: ownedMap.get(b.code) || null })),
      beforeAfter: first && latest && first.id !== latest.id ? { before: serializeDrawing(first), after: serializeDrawing(latest) } : null,
      today: dayKey(),
    });
  }),
);

// ------------------------------------------------------------------ challenges
studentRouter.get(
  '/challenges',
  requireAuth('student'),
  ah(async (req, res) => {
    const list = await prisma.challenge.findMany({ where: { active: true }, orderBy: { startsAt: 'desc' }, take: 6, include: { _count: { select: { entries: true } } } });
    const mine = await prisma.challengeEntry.findMany({ where: { userId: req.user!.id } });
    const byId = new Map(mine.map((e) => [e.challengeId, e]));
    res.json({
      challenges: list.map((c) => ({ ...c, entries: c._count.entries, joined: byId.has(c.id), submittedDrawingId: byId.get(c.id)?.drawingId || null })),
    });
  }),
);

async function openChallenge(id: string) {
  const c = await prisma.challenge.findUnique({ where: { id } });
  if (!c || !c.active) throw new HttpError(404, 'Challenge not found.');
  if (c.endsAt.getTime() < Date.now()) throw new HttpError(400, 'This challenge has ended.');
  return c;
}

studentRouter.post(
  '/challenges/:id/join',
  requireAuth('student'),
  ah(async (req, res) => {
    const c = await openChallenge(req.params.id);
    await prisma.challengeEntry.upsert({
      where: { challengeId_userId: { challengeId: c.id, userId: req.user!.id } },
      update: {},
      create: { challengeId: c.id, userId: req.user!.id },
    });
    res.json({ ok: true });
  }),
);

studentRouter.delete(
  '/challenges/:id/join',
  requireAuth('student'),
  ah(async (req, res) => {
    await prisma.challengeEntry.deleteMany({ where: { challengeId: req.params.id, userId: req.user!.id } });
    res.json({ ok: true });
  }),
);

studentRouter.post(
  '/challenges/:id/submit',
  requireAuth('student'),
  ah(async (req, res) => {
    const c = await openChallenge(req.params.id);
    const { drawingId } = parse(z.object({ drawingId: z.string() }), req.body);
    const d = await prisma.drawing.findFirst({ where: { id: drawingId, userId: req.user!.id, status: 'done' } });
    if (!d) throw new HttpError(404, 'Drawing not found.');
    await prisma.challengeEntry.upsert({
      where: { challengeId_userId: { challengeId: c.id, userId: req.user!.id } },
      update: { drawingId: d.id, submittedAt: new Date() },
      create: { challengeId: c.id, userId: req.user!.id, drawingId: d.id, submittedAt: new Date() },
    });
    const newBadges = await evaluateBadges(req.user!.id);
    res.json({ ok: true, newBadges });
  }),
);

// ------------------------------------------------------------------ notifications
studentRouter.get(
  '/notifications',
  requireAuth(),
  ah(async (req, res) => {
    const list = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ notifications: list });
  }),
);

studentRouter.post(
  '/notifications/read',
  requireAuth(),
  ah(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    res.json({ ok: true });
  }),
);
