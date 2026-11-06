export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, navigator.onLine ? 'Could not reach Smart Art. Please try again.' : "You're offline. Connect to the internet and try again.", 'offline');
  }
  const text = await res.text();
  const data = text ? safeParse(text) : {};
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, (data as { code?: string })?.code);
  }
  return data as T;
}

function safeParse(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { error: t.slice(0, 200) };
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T>(url: string, body?: unknown) => request<T>('DELETE', url, body),
};


export function timeAgo(iso: string | Date, lang: 'en' | 'ur' = 'en') {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (lang === 'ur') {
    if (diff < 60) return 'ابھی';
    if (sameDay) return 'آج';
    if (diff < 2 * 86400) return 'کل';
    return d.toLocaleDateString('ur-PK', { day: 'numeric', month: 'short' });
  }
  if (diff < 60) return 'just now';
  if (sameDay) return 'today';
  if (diff < 2 * 86400 && new Date(today.getTime() - 86400000).toDateString() === d.toDateString()) return 'yesterday';
  if (diff < 6 * 86400) return d.toLocaleDateString('en', { weekday: 'short' });
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

/** Shrink a photo in the browser before upload (keeps uploads small on mobile data). */
export async function downscale(file: Blob, max = 1400, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}
