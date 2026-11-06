import type { Drawing } from '@prisma/client';
import { prisma } from '../db.js';
import { waitUntil } from '@vercel/functions';
import { env } from '../env.js';
import { readFile } from './storage.js';
import { analyseDrawing } from '../ai/coach.js';
import { ageFromBirthYear, safeJson } from '../util.js';
import { evaluateBadges } from './badges.js';
import { notify } from './notify.js';

export function serializeDrawing(d: Drawing) {
  return {
    id: d.id,
    userId: d.userId,
    title: d.title,
    mode: d.mode,
    status: d.status,
    error: d.status === 'failed' || d.status === 'rejected' ? d.error : null,
    provider: d.provider,
    praise: safeJson(d.praise, null),
    tips: safeJson(d.tips, []),
    scores: safeJson(d.scores, null),
    exercise: safeJson<{ en: string; ur: string } | null>(d.exercise, null),
    imageUrl: `/api/drawings/${d.id}/image`,
    createdAt: d.createdAt,
    analyzedAt: d.analyzedAt,
  };
}

// A tiny in-process queue so a local model only handles one image at a time.
const queue: string[] = [];
let running = false;

export function enqueueAnalysis(drawingId: string) {
  if (env.onVercel) {
    // Serverless: keep this function alive after the response until the analysis is saved.
    waitUntil(runAnalysis(drawingId).catch((e) => console.error('analysis crashed', drawingId, e)));
    return;
  }
  if (!queue.includes(drawingId)) queue.push(drawingId);
  void pump();
}

/** On serverless a function can be cut off; anything "processing" for too long is marked failed so it can be retried. */
export async function failIfStale<T extends Pick<Drawing, 'id' | 'status' | 'createdAt' | 'analyzedAt'>>(d: T): Promise<T | Drawing> {
  if (!env.onVercel || d.status !== 'processing') return d;
  const limit = env.ai.timeoutMs + 60_000;
  if (Date.now() - d.createdAt.getTime() < limit) return d;
  return prisma.drawing.update({ where: { id: d.id }, data: { status: 'failed', error: 'The coach took too long. Please try again.' } });
}

async function pump() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift()!;
      await runAnalysis(id).catch((e) => console.error('analysis crashed', id, e));
    }
  } finally {
    running = false;
  }
}

async function runAnalysis(id: string) {
  const d = await prisma.drawing.findUnique({ where: { id }, include: { user: true } });
  if (!d || d.status !== 'processing') return;
  const started = Date.now();
  try {
    const image = await readFile(d.imagePath);
    const r = await analyseDrawing({
      image,
      mime: d.mime,
      mode: d.mode === 'screen' ? 'screen' : 'paper',
      age: ageFromBirthYear(d.user.birthYear),
      language: d.user.language === 'ur' ? 'ur' : 'en',
    });
    if (!r.isDrawing) {
      await prisma.drawing.update({
        where: { id },
        data: {
          status: 'rejected',
          error: "We couldn't find a drawing in this photo. Lay your paper flat and try again.",
          provider: r.provider,
          model: r.model,
          durationMs: Date.now() - started,
          analyzedAt: new Date(),
        },
      });
      return;
    }
    const title = d.title === 'My drawing' && r.subject && r.subject !== 'My drawing' ? capitalise(r.subject) : d.title;
    await prisma.drawing.update({
      where: { id },
      data: {
        status: 'done',
        title,
        provider: r.provider,
        model: r.model,
        praise: JSON.stringify(r.praise),
        exercise: JSON.stringify(r.exercise),
        tips: JSON.stringify(r.tips),
        scores: JSON.stringify(r.scores),
        durationMs: Date.now() - started,
        analyzedAt: new Date(),
        error: null,
      },
    });
    await evaluateBadges(d.userId);
    await notify(d.userId, 'Your tips are ready', `Your coach looked at "${title}".`, `/app/drawings/${id}`);
  } catch (e) {
    await prisma.drawing.update({
      where: { id },
      data: { status: 'failed', error: (e as Error).message.slice(0, 500), durationMs: Date.now() - started },
    });
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** On boot, re-queue drawings that were still processing when the server stopped. */
export async function resumePending() {
  const pending = await prisma.drawing.findMany({ where: { status: 'processing' }, select: { id: true } });
  pending.forEach((p) => enqueueAnalysis(p.id));
}
