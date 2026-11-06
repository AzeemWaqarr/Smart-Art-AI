import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { prisma } from './db.js';
import { env } from './env.js';
import { HttpError } from './util.js';

export type Role = 'student' | 'parent' | 'admin';
const COOKIE = 'sa_session';
const MAX_AGE_DAYS = 30;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function setSession(res: Response, user: User) {
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: MAX_AGE_DAYS * 86400 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Loads the user from the session cookie (if any). Never throws. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.status === 'active') req.user = user;
  } catch {
    /* invalid or expired token: treat as signed out */
  }
  next();
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please log in.', 'auth'));
    if (roles.length && !roles.includes(req.user.role as Role)) {
      return next(new HttpError(403, 'You do not have access to this.', 'forbidden'));
    }
    next();
  };
}

/** Public shape of a user that is safe to send to the browser. */
export function publicUser(u: User) {
  return {
    id: u.id,
    role: u.role as Role,
    name: u.name,
    email: u.email,
    username: u.username,
    birthYear: u.birthYear,
    language: u.language,
    phone: u.phone,
    status: u.status,
    parentId: u.parentId,
    weeklyReport: u.weeklyReport,
    shareTeacher: u.shareTeacher,
    dailyLimitOn: u.dailyLimitOn,
    dailyLimitMin: u.dailyLimitMin,
    createdAt: u.createdAt,
  };
}


/** Can `viewer` see data of the student `ownerId`? (self, their parent, or an admin) */
export async function canViewStudent(viewer: User, ownerId: string) {
  if (viewer.id === ownerId || viewer.role === 'admin') return true;
  if (viewer.role === 'parent') {
    const child = await prisma.user.findFirst({ where: { id: ownerId, parentId: viewer.id }, select: { id: true } });
    return !!child;
  }
  return false;
}

/** Resolve the student whose data is requested (?userId= for parents), enforcing access. */
export async function resolveStudentId(req: Request) {
  const me = req.user!;
  const asked = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  if (!asked || asked === me.id) {
    if (me.role !== 'student') throw new HttpError(400, 'Choose a child first.');
    return me.id;
  }
  if (!(await canViewStudent(me, asked))) throw new HttpError(403, 'You do not have access to this.');
  return asked;
}
