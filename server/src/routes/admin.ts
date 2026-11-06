import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { aiIsReal, env } from '../env.js';
import { publicUser, requireAuth } from '../auth.js';
import { addDays, ah, dayKey, dayStartUtc, HttpError, parse, safeJson, weekStart } from '../util.js';
import { testAi } from '../ai/coach.js';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../services/settings.js';
import { audit, notify } from '../services/notify.js';
import { enqueueAnalysis, serializeDrawing } from '../services/drawings.js';
import { skillLevels, streak, weekSummary } from '../services/stats.js';

export const adminRouter = Router();
adminRouter.use(requireAuth('admin'));

// ------------------------------------------------------------------ dashboard
adminRouter.get(
  '/stats',
  ah(async (_req, res) => {
    const today = dayKey();
    const weekFrom = dayStartUtc(weekStart(today));
    const [students, parents, admins, drawingsWeek, drawingsTotal, failed, processing, active7] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.user.count({ where: { role: 'parent' } }),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.drawing.count({ where: { createdAt: { gte: weekFrom } } }),
      prisma.drawing.count(),
      prisma.drawing.count({ where: { status: 'failed' } }),
      prisma.drawing.count({ where: { status: 'processing' } }),
      prisma.user.count({ where: { role: 'student', lastActiveAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    // signups and drawings for the last 14 days
    const from = addDays(today, -13);
    const [signups, drawings] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: dayStartUtc(from) } }, select: { createdAt: true } }),
      prisma.drawing.findMany({ where: { createdAt: { gte: dayStartUtc(from) } }, select: { createdAt: true } }),
    ]);
    const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
    const tally = (rows: { createdAt: Date }[]) => {
      const m = new Map<string, number>();
      rows.forEach((r) => m.set(dayKey(r.createdAt), (m.get(dayKey(r.createdAt)) || 0) + 1));
      return days.map((d) => ({ day: d, count: m.get(d) || 0 }));
    };

    res.json({
      users: { students, parents, admins, active7 },
      drawings: { week: drawingsWeek, total: drawingsTotal, failed, processing },
      daily: { signups: tally(signups), drawings: tally(drawings) },
      ai: { real: aiIsReal(), provider: aiIsReal() ? 'openai' : 'mock', model: aiIsReal() ? env.ai.model : 'demo-coach', baseUrl: env.ai.baseUrl || null },
    });
  }),
);

// ------------------------------------------------------------------ users
adminRouter.get(
  '/users',
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '');
    const status = String(req.query.status || '');
    const page = Math.max(1, Number(req.query.page || 1));
    const take = 25;
    const where: Prisma.UserWhereInput = {};
    if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { username: { contains: q.toLowerCase() } }];
    if (['student', 'parent', 'admin'].includes(role)) where.role = role;
    if (status === 'active' || status === 'suspended') where.status = status;
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { parent: { select: { id: true, name: true } }, _count: { select: { drawings: true, children: true } } },
      }),
    ]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / take)),
      users: users.map((u) => ({ ...publicUser(u), lastActiveAt: u.lastActiveAt, parent: u.parent, drawings: u._count.drawings, children: u._count.children })),
    });
  }),
);

adminRouter.get(
  '/users/:id',
  ah(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { parent: true, children: true, badges: true },
    });
    if (!u) throw new HttpError(404, 'User not found.');
    const [drawings, sessions] = await Promise.all([
      prisma.drawing.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.practiceSession.count({ where: { userId: u.id } }),
    ]);
    res.json({
      user: { ...publicUser(u), lastActiveAt: u.lastActiveAt },
      parent: u.parent ? publicUser(u.parent) : null,
      children: u.children.map(publicUser),
      badges: u.badges.map((b) => b.code),
      stats: u.role === 'student' ? { ...(await weekSummary(u.id)), streak: await streak(u.id), practices: sessions, skills: await skillLevels(u.id) } : null,
      // Drawings stay private: admins see feedback metadata, never the photo itself.
      drawings: drawings.map((d) => {
        const s = serializeDrawing(d);
        return { id: s.id, title: s.title, status: s.status, error: d.error, provider: s.provider, scores: s.scores, createdAt: s.createdAt, durationMs: d.durationMs };
      }),
    });
  }),
);

const thisYear = new Date().getFullYear();
adminRouter.post(
  '/users',
  ah(async (req, res) => {
    const body = parse(
      z.object({
        role: z.enum(['student', 'parent', 'admin']),
        name: z.string().trim().min(1).max(60),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8).max(100),
        birthYear: z.number().int().min(thisYear - 100).max(thisYear).optional(),
      }),
      req.body,
    );
    const user = await prisma.user.create({
      data: { role: body.role, name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10), birthYear: body.birthYear },
    });
    await audit(req.user!.id, 'user.create', user.id, { role: user.role, email: user.email });
    res.status(201).json({ user: publicUser(user) });
  }),
);

adminRouter.patch(
  '/users/:id',
  ah(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        email: z.string().trim().toLowerCase().email().nullable().optional(),
        status: z.enum(['active', 'suspended']).optional(),
        language: z.enum(['en', 'ur']).optional(),
      }),
      req.body,
    );
    if (req.params.id === req.user!.id && body.status === 'suspended') throw new HttpError(400, 'You cannot suspend yourself.');
    const data: Prisma.UserUpdateInput = body;
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await audit(req.user!.id, 'user.update', user.id, body);
    res.json({ user: publicUser(user) });
  }),
);

adminRouter.post(
  '/users/:id/password',
  ah(async (req, res) => {
    const { password } = parse(z.object({ password: z.string().min(6).max(100) }), req.body);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await audit(req.user!.id, 'user.password_reset', req.params.id);
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/users/:id',
  ah(async (req, res) => {
    if (req.params.id === req.user!.id) throw new HttpError(400, 'You cannot delete yourself.');
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { children: { select: { id: true } } } });
    if (!u) throw new HttpError(404, 'User not found.');
    await prisma.user.delete({ where: { id: u.id } }); // children cascade
    for (const id of [u.id, ...u.children.map((c) => c.id)]) await fs.rm(path.join(env.uploadDir, id), { recursive: true, force: true });
    await audit(req.user!.id, 'user.delete', u.id, { email: u.email, username: u.username, role: u.role, children: u.children.length });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ lessons
const lessonSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'use lowercase letters, numbers and dashes').max(60),
  title: z.string().trim().min(1).max(80),
  titleUr: z.string().trim().max(120).nullable().optional(),
  category: z.enum(['light', 'colour', 'proportion', 'composition', 'perspective', 'shapes']),
  summary: z.string().trim().min(1).max(200),
  summaryUr: z.string().trim().max(300).nullable().optional(),
  durationMin: z.number().int().min(1).max(120),
  steps: z.array(z.object({ en: z.string().trim().min(1).max(200), ur: z.string().trim().max(300).optional() })).min(1).max(12),
  published: z.boolean(),
  sortOrder: z.number().int().default(0),
});

adminRouter.get(
  '/lessons',
  ah(async (_req, res) => {
    const lessons = await prisma.lesson.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { sessions: true } } } });
    res.json({ lessons: lessons.map((l) => ({ ...l, steps: safeJson(l.steps, []), sessions: l._count.sessions })) });
  }),
);

adminRouter.post(
  '/lessons',
  ah(async (req, res) => {
    const b = parse(lessonSchema, req.body);
    const l = await prisma.lesson.create({ data: { ...b, steps: JSON.stringify(b.steps) } });
    await audit(req.user!.id, 'lesson.create', l.id, { title: l.title });
    res.status(201).json({ lesson: { ...l, steps: b.steps } });
  }),
);

adminRouter.put(
  '/lessons/:id',
  ah(async (req, res) => {
    const b = parse(lessonSchema, req.body);
    const l = await prisma.lesson.update({ where: { id: req.params.id }, data: { ...b, steps: JSON.stringify(b.steps) } });
    await audit(req.user!.id, 'lesson.update', l.id, { title: l.title });
    res.json({ lesson: { ...l, steps: b.steps } });
  }),
);

adminRouter.delete(
  '/lessons/:id',
  ah(async (req, res) => {
    await prisma.lesson.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'lesson.delete', req.params.id);
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ challenges
const challengeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  titleUr: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().min(1).max(400),
  descriptionUr: z.string().trim().max(600).nullable().optional(),
  prize: z.string().trim().max(150).nullable().optional(),
  startsAt: z.string().min(8),
  endsAt: z.string().min(8),
  active: z.boolean(),
});

function challengeData(b: z.infer<typeof challengeSchema>) {
  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(b.endsAt);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) throw new HttpError(400, 'Dates are not valid.');
  if (endsAt <= startsAt) throw new HttpError(400, 'The end date must be after the start date.');
  return { ...b, startsAt, endsAt };
}

adminRouter.get(
  '/challenges',
  ah(async (_req, res) => {
    const list = await prisma.challenge.findMany({ orderBy: { startsAt: 'desc' }, include: { entries: { select: { drawingId: true } } } });
    res.json({
      challenges: list.map(({ entries, ...c }) => ({ ...c, joined: entries.length, submitted: entries.filter((e) => e.drawingId).length })),
    });
  }),
);

adminRouter.post(
  '/challenges',
  ah(async (req, res) => {
    const c = await prisma.challenge.create({ data: challengeData(parse(challengeSchema, req.body)) });
    await audit(req.user!.id, 'challenge.create', c.id, { title: c.title });
    res.status(201).json({ challenge: c });
  }),
);

adminRouter.put(
  '/challenges/:id',
  ah(async (req, res) => {
    const c = await prisma.challenge.update({ where: { id: req.params.id }, data: challengeData(parse(challengeSchema, req.body)) });
    await audit(req.user!.id, 'challenge.update', c.id, { title: c.title });
    res.json({ challenge: c });
  }),
);

adminRouter.delete(
  '/challenges/:id',
  ah(async (req, res) => {
    await prisma.challenge.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'challenge.delete', req.params.id);
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ AI monitoring
adminRouter.get(
  '/drawings',
  ah(async (req, res) => {
    const status = String(req.query.status || '');
    const list = await prisma.drawing.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true } } },
    });
    res.json({
      drawings: list.map((d) => ({ id: d.id, title: d.title, status: d.status, error: d.error, provider: d.provider, model: d.model, durationMs: d.durationMs, createdAt: d.createdAt, user: d.user })),
    });
  }),
);

adminRouter.post(
  '/drawings/:id/retry',
  ah(async (req, res) => {
    const d = await prisma.drawing.findUnique({ where: { id: req.params.id } });
    if (!d) throw new HttpError(404, 'Drawing not found.');
    await prisma.drawing.update({ where: { id: d.id }, data: { status: 'processing', error: null } });
    enqueueAnalysis(d.id);
    res.json({ ok: true });
  }),
);

adminRouter.post('/ai/test', ah(async (_req, res) => res.json(await testAi())));

// ------------------------------------------------------------------ settings & audit
adminRouter.get('/settings', ah(async (_req, res) => res.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS })));

adminRouter.put(
  '/settings',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        autoDailyChallenge: z.number().int().min(0).max(1).optional(),
        supportContact: z.string().trim().max(120).optional(),
      }),
      req.body,
    );
    const settings = await updateSettings(b);
    await audit(req.user!.id, 'settings.update', undefined, b);
    res.json({ settings });
  }),
);

adminRouter.get(
  '/audit',
  ah(async (_req, res) => {
    const list = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { id: true, name: true, role: true } } } });
    res.json({ logs: list.map((l) => ({ ...l, details: safeJson(l.details, null) })) });
  }),
);

/** Broadcast an in-app notification (e.g. a new challenge). */
adminRouter.post(
  '/broadcast',
  ah(async (req, res) => {
    const b = parse(z.object({ audience: z.enum(['students', 'parents', 'all']), title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(300), link: z.string().trim().max(100).optional() }), req.body);
    const roles = b.audience === 'all' ? ['student', 'parent'] : [b.audience === 'students' ? 'student' : 'parent'];
    const users = await prisma.user.findMany({ where: { role: { in: roles }, status: 'active' }, select: { id: true } });
    await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, title: b.title, body: b.body, link: b.link || null })) });
    await audit(req.user!.id, 'broadcast', b.audience, { title: b.title, count: users.length });
    res.json({ sent: users.length });
  }),
);
