import { storageGet, storageSet } from "./chromeStorage";
import { slugify } from "./format";
import { type CategorySetting, DEFAULT_SETTINGS, type Settings } from "./types";

const STORAGE_KEY = "webclip:settings";
const MRU_LIMIT = 5;

export async function getSettings(): Promise<Settings> {
  const stored = await storageGet<Partial<Settings>>(STORAGE_KEY);
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  const normalized = normalizeSettings(next);
  await storageSet(STORAGE_KEY, normalized);
  return normalized;
}

export async function pushMruEntry(path: string): Promise<Settings> {
  const settings = await getSettings();
  const nextMru = [path, ...settings.mruFiles.filter((item) => item !== path)];
  settings.mruFiles = nextMru.slice(0, MRU_LIMIT);
  await storageSet(STORAGE_KEY, settings);
  return settings;
}

function normalizeSettings(settings: Settings): Settings {
  const singleFilePath = settings.singleFilePath.trim() || "inbox.md";
  const aggregateFileName =
    settings.categoryAggregateFileName.trim() || "inbox.md";
  const categories = (settings.categories ?? [])
    .map((item) => normalizeCategory(item))
    .filter((item): item is CategorySetting => item !== undefined);
  return {
    ...settings,
    singleFilePath,
    categoryAggregateFileName: aggregateFileName,
    categories,
  };
}

function normalizeCategory(
  input: CategorySetting,
): CategorySetting | undefined {
  const label = input.label?.trim();
  if (!label) {
    return undefined;
  }
  const folder = input.folder?.trim() || slugify(label);
  const aggregate = Boolean(input.aggregate);
  return {
    id: input.id || crypto.randomUUID(),
    label,
    folder,
    aggregate,
  };
}
