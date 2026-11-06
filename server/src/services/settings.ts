import { prisma } from '../db.js';

export const DEFAULT_SETTINGS = {
  autoDailyChallenge: 1, // 1 = create a "Today's challenge" automatically each day
  supportContact: 'support@smartart.local',
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const rows = await prisma.appSetting.findMany();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    const def = DEFAULT_SETTINGS[r.key as SettingKey];
    out[r.key] = typeof def === 'number' ? Number(r.value) : r.value;
  }
  cache = out as Settings;
  return cache;
}

export async function updateSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  cache = null;
  return getSettings();
}
