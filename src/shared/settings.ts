import { storageGet, storageSet } from "./chromeStorage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const STORAGE_KEY = "webclip:settings";
const MRU_LIMIT = 5;

export async function getSettings(): Promise<Settings> {
  const stored = await storageGet<Partial<Settings>>(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await storageSet(STORAGE_KEY, next);
  return next;
}

export async function pushMruEntry(path: string): Promise<Settings> {
  const settings = await getSettings();
  const nextMru = [path, ...settings.mruFiles.filter((item) => item !== path)];
  settings.mruFiles = nextMru.slice(0, MRU_LIMIT);
  await storageSet(STORAGE_KEY, settings);
  return settings;
}
