import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { clearSession, publicUser, requireAuth, setSession } from '../auth.js';
import { ah, dayKey, HttpError, parse } from '../util.js';
import { minutesToday, timeLimitReached } from '../services/stats.js';

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes.' } });

const password = z.string().min(8, 'must be at least 8 characters').max(100);
const thisYear = new Date().getFullYear();

const signupSchema = z.object({
  role: z.enum(['student', 'parent']),
  name: z.string().trim().min(1, 'is required').max(60),
  email: z.string().trim().toLowerCase().email('is not a valid email'),
  password,
  birthYear: z.number().int().min(thisYear - 100).max(thisYear).optional(),
  phone: z.string().trim().max(20).optional(),
  language: z.enum(['en', 'ur']).default('en'),
});

authRouter.post(
  '/signup',
  limiter,
  ah(async (req, res) => {
    const body = parse(signupSchema, req.body);
    if (body.role === 'student') {
      if (!body.birthYear) throw new HttpError(400, 'Please tell us your birth year.');
      if (thisYear - body.birthYear < 13) {
        throw new HttpError(400, 'Under 13? Ask a parent to create a family account and add you.', 'under13');
      }
    }
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new HttpError(409, 'An account with this email already exists. Try logging in.');
    const user = await prisma.user.create({
      data: {
        role: body.role,
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        birthYear: body.role === 'student' ? body.birthYear : null,
        phone: body.phone || null,
        language: body.language,
      },
    });
    setSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  }),
);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'is required'),
  password: z.string().min(1, 'is required'),
});

authRouter.post(
  '/login',
  limiter,
  ah(async (req, res) => {
    const { identifier, password: pw } = parse(loginSchema, req.body);
    const id = identifier.toLowerCase();
    const user = await prisma.user.findFirst({ where: { OR: [{ email: id }, { username: id }] } });
    if (!user || !(await bcrypt.compare(pw, user.passwordHash))) {
      throw new HttpError(401, 'That email/username or password is not right.');
    }
    if (user.status !== 'active') throw new HttpError(403, 'This account is paused. Please contact support.');
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    setSession(res, user);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  ah(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const u = req.user;
    const [unread, parent] = await Promise.all([
      prisma.notification.count({ where: { userId: u.id, read: false } }),
      u.parentId ? prisma.user.findUnique({ where: { id: u.parentId }, select: { id: true, name: true } }) : null,
    ]);
    res.json({
      user: publicUser(u),
      parent,
      unread,
      minutesToday: u.role === 'student' ? await minutesToday(u.id) : 0,
      timeLimitReached: await timeLimitReached(u),
    });
  }),
);

// ---------- account (any signed-in user) ----------
const profileSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  language: z.enum(['en', 'ur']).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

authRouter.patch(
  '/me',
  requireAuth(),
  ah(async (req, res) => {
    const data = parse(profileSchema, req.body);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/me/password',
  requireAuth(),
  ah(async (req, res) => {
    const { current, next } = parse(z.object({ current: z.string(), next: password }), req.body);
    if (!(await bcrypt.compare(current, req.user!.passwordHash))) throw new HttpError(400, 'Your current password is not right.');
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    res.json({ ok: true });
  }),
);

/** Teens 13+ control their own settings; children's are set by their parent. */
authRouter.patch(
  '/me/settings',
  requireAuth('student'),
  ah(async (req, res) => {
    if (req.user!.parentId) throw new HttpError(403, 'Your parent manages these settings.');
    const data = parse(
      z.object({ weeklyReport: z.boolean().optional(), dailyLimitOn: z.boolean().optional(), dailyLimitMin: z.number().int().min(10).max(240).optional() }),
      req.body,
    );
    const user = await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ user: publicUser(user) });
  }),
);

/** Called by the app once a minute while it is open; powers the daily time limit. */
authRouter.post(
  '/me/heartbeat',
  requireAuth(),
  ah(async (req, res) => {
    const u = req.user!;
    if (u.role !== 'student') return res.json({ minutesToday: 0, timeLimitReached: false });
    const day = dayKey();
    await prisma.dailyActivity.upsert({
      where: { userId_day: { userId: u.id, day } },
      update: { minutes: { increment: 1 } },
      create: { userId: u.id, day, minutes: 1 },
    });
    await prisma.user.update({ where: { id: u.id }, data: { lastActiveAt: new Date() } });
    res.json({ minutesToday: await minutesToday(u.id), timeLimitReached: await timeLimitReached(u) });
  }),
);

authRouter.delete(
  '/me',
  requireAuth('student', 'parent'),
  ah(async (req, res) => {
    const { password: pw } = parse(z.object({ password: z.string() }), req.body);
    if (!(await bcrypt.compare(pw, req.user!.passwordHash))) throw new HttpError(400, 'Your password is not right.');
    if (req.user!.parentId) throw new HttpError(403, 'Ask your parent to remove your account.');
    await prisma.user.delete({ where: { id: req.user!.id } });
    clearSession(res);
    res.json({ ok: true });
  }),
);
