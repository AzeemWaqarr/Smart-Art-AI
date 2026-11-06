import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { env } from './env.js';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Wrap an async route so thrown errors reach the error handler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const where = first?.path?.join('.') || 'input';
    throw new HttpError(400, `${where}: ${first?.message || 'invalid'}`, 'validation');
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', code: 'validation' });
    return;
  }
  const anyErr = err as { code?: string; message?: string; status?: number };
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'That photo is too big. Please use one under 8 MB.', code: 'too_big' });
    return;
  }
  if (anyErr?.code === 'P2002') {
    res.status(409).json({ error: 'That value is already taken.', code: 'conflict' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// ---------- dates (in the app's time zone) ----------
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: env.tz, year: 'numeric', month: '2-digit', day: '2-digit' });

/** YYYY-MM-DD for a moment, in APP_TZ. */
export function dayKey(d: Date = new Date()) {
  return dayFmt.format(d);
}

/** Days between two YYYY-MM-DD keys (b - a). */
export function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function addDays(key: string, n: number) {
  const t = new Date(Date.parse(key + 'T00:00:00Z') + n * 86400000);
  return t.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing `key`. */
export function weekStart(key: string) {
  const d = new Date(key + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(key, -dow);
}

/**
 * Converts a YYYY-MM-DD key in APP_TZ to the UTC instant of its local midnight.
 * Good enough for range queries (handles fixed-offset zones exactly, DST zones within the hour).
 */
export function dayStartUtc(key: string) {
  const guess = new Date(key + 'T00:00:00Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function ageFromBirthYear(y?: number | null) {
  if (!y) return null;
  return new Date().getFullYear() - y;
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
