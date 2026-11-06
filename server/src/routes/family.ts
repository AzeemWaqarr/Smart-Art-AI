import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { publicUser, requireAuth } from '../auth.js';
import { ah, HttpError, parse } from '../util.js';
import { minutesToday, streak, weekSummary } from '../services/stats.js';
import { notify } from '../services/notify.js';

export const familyRouter = Router();
familyRouter.use(requireAuth('parent'));

const thisYear = new Date().getFullYear();

async function ownChild(parentId: string, childId: string) {
  const c = await prisma.user.findFirst({ where: { id: childId, parentId } });
  if (!c) throw new HttpError(404, 'Child not found.');
  return c;
}

familyRouter.get(
  '/',
  ah(async (req, res) => {
    const kids = await prisma.user.findMany({ where: { parentId: req.user!.id }, orderBy: { createdAt: 'asc' } });
    const children = await Promise.all(
      kids.map(async (k) => ({
        ...publicUser(k),
        week: await weekSummary(k.id),
        streak: await streak(k.id),
        minutesToday: await minutesToday(k.id),
      })),
    );
    res.json({ children });
  }),
);

const childSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'must be at least 3 characters')
    .max(30)
    .regex(/^[a-z0-9._-]+$/, 'can only use letters, numbers, dots, dashes and underscores'),
  password: z.string().min(6, 'must be at least 6 characters').max(100),
  birthYear: z.number().int().min(thisYear - 18).max(thisYear - 3),
  language: z.enum(['en', 'ur']).default('en'),
});

familyRouter.post(
  '/children',
  ah(async (req, res) => {
    const body = parse(childSchema, req.body);
    if (await prisma.user.findFirst({ where: { OR: [{ username: body.username }, { email: body.username }] } })) {
      throw new HttpError(409, 'That username is taken. Try adding a number.');
    }
    const child = await prisma.user.create({
      data: {
        role: 'student',
        name: body.name,
        username: body.username,
        passwordHash: await bcrypt.hash(body.password, 10),
        birthYear: body.birthYear,
        language: body.language,
        parentId: req.user!.id,
        weeklyReport: true,
        shareTeacher: false,
      },
    });
    await notify(child.id, `Welcome to Smart Art, ${child.name}!`, 'Snap your first drawing to get kind tips from your coach.', '/app/coach');
    res.status(201).json({ child: publicUser(child) });
  }),
);

familyRouter.patch(
  '/children/:id',
  ah(async (req, res) => {
    const child = await ownChild(req.user!.id, req.params.id);
    const data = parse(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        language: z.enum(['en', 'ur']).optional(),
        weeklyReport: z.boolean().optional(),
        shareTeacher: z.boolean().optional(),
        dailyLimitOn: z.boolean().optional(),
        dailyLimitMin: z.number().int().min(10).max(240).optional(),
      }),
      req.body,
    );
    const out = await prisma.user.update({ where: { id: child.id }, data });
    res.json({ child: publicUser(out) });
  }),
);

familyRouter.post(
  '/children/:id/password',
  ah(async (req, res) => {
    const child = await ownChild(req.user!.id, req.params.id);
    const { password } = parse(z.object({ password: z.string().min(6, 'must be at least 6 characters').max(100) }), req.body);
    await prisma.user.update({ where: { id: child.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    res.json({ ok: true });
  }),
);

familyRouter.delete(
  '/children/:id',
  ah(async (req, res) => {
    const child = await ownChild(req.user!.id, req.params.id);
    await prisma.user.delete({ where: { id: child.id } });
    await fs.rm(path.join(env.uploadDir, child.id), { recursive: true, force: true });
    res.json({ ok: true });
  }),
);
