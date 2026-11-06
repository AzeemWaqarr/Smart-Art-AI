/* Where drawing photos live.
   - Vercel (BLOB_READ_WRITE_TOKEN set): Vercel Blob. Blob URLs get a random suffix and are never sent to the
     browser; photos are always served through the logged-in /api/drawings/:id/image route.
   - Anywhere else: the local UPLOAD_DIR folder. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { del, list, put } from '@vercel/blob';
import { env } from '../env.js';

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const isUrl = (p: string) => /^https?:\/\//.test(p);

/** Saves a file under `key` (e.g. "<userId>/<uuid>.jpg") and returns what to store in Drawing.imagePath. */
export async function saveFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (useBlob()) {
    const blob = await put(`drawings/${key}`, data, { access: 'public', contentType, addRandomSuffix: true });
    return blob.url;
  }
  const file = path.join(env.uploadDir, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  return key;
}

export async function readFile(stored: string): Promise<Buffer> {
  if (isUrl(stored)) {
    const res = await fetch(stored);
    if (!res.ok) throw new Error(`Could not load image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(path.join(env.uploadDir, stored));
}

export async function removeFile(stored: string) {
  try {
    if (isUrl(stored)) await del(stored);
    else await fs.rm(path.join(env.uploadDir, stored), { force: true });
  } catch (e) {
    console.warn('could not delete file', stored, (e as Error).message);
  }
}

/** Deletes every photo belonging to a user (used when an account is removed). */
export async function removeUserFiles(userId: string) {
  try {
    if (useBlob()) {
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `drawings/${userId}/`, cursor });
        if (page.blobs.length) await del(page.blobs.map((b) => b.url));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    } else {
      await fs.rm(path.join(env.uploadDir, userId), { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('could not delete files for', userId, (e as Error).message);
  }
}
