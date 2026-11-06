import { prisma } from '../db.js';

export async function notify(userId: string, title: string, body: string, link?: string) {
  await prisma.notification.create({ data: { userId, title, body, link } });
}

export async function audit(actorId: string | null, action: string, target?: string, details?: unknown) {
  await prisma.auditLog.create({
    data: { actorId, action, target, details: details === undefined ? null : JSON.stringify(details) },
  });
}
