import { storageGet, storageSet } from "./chromeStorage";
import {
  type CategorySetting,
  type CategorySubfolder,
  DEFAULT_ENTRY_TEMPLATE,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE_ID,
  type Settings,
  type TemplateFrontMatterField,
  type TemplateSetting,
} from "./types";

const STORAGE_KEY = "webclip:settings";
const MRU_LIMIT = 5;

const DEFAULT_TEMPLATE_PRESET: TemplateSetting = DEFAULT_SETTINGS
  .templates[0] ?? {
  id: DEFAULT_TEMPLATE_ID,
  name: "Template 1",
  useDomainSubfolders: true,
  singleFilePath: "inbox.md",
  categories: [],
  categoryAggregateFileName: "inbox.md",
  frontMatter: {
    enabled: false,
    fields: [],
  },
  entryTemplate: DEFAULT_ENTRY_TEMPLATE,
};

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

export function getTemplateById(
  settings: Settings,
  templateId: string,
): TemplateSetting | undefined {
  return settings.templates.find((template) => template.id === templateId);
}

export function getActiveTemplate(settings: Settings): TemplateSetting {
  return (
    getTemplateById(settings, settings.activeTemplateId) ??
    settings.templates[0] ??
    DEFAULT_TEMPLATE_PRESET
  );
}

type LegacySettings = Partial<Settings> & {
  singleFilePath?: string;
  useDomainSubfolders?: boolean;
  categories?: CategorySetting[];
  categoryAggregateFileName?: string;
  templates?: Partial<TemplateSetting>[];
};

function normalizeSettings(raw: Settings | LegacySettings): Settings {
  const theme = raw.theme ?? DEFAULT_SETTINGS.theme;
  const mruFiles = Array.isArray(raw.mruFiles) ? raw.mruFiles : [];
  const rootFolderName = raw.rootFolderName;
  const templates = normalizeTemplates(raw);
  const activeTemplateId =
    raw.activeTemplateId &&
    templates.some((item) => item.id === raw.activeTemplateId)
      ? raw.activeTemplateId
      : (templates[0]?.id ?? DEFAULT_TEMPLATE_ID);
  return {
    theme,
    mruFiles,
    rootFolderName,
    activeTemplateId,
    templates,
  };
}

function normalizeTemplates(raw: LegacySettings): TemplateSetting[] {
  const inputTemplates = Array.isArray(raw.templates) ? raw.templates : null;
  const templates = (inputTemplates ?? []).map((item) =>
    normalizeTemplate(item),
  );
  const normalized = templates.filter(
    (item): item is TemplateSetting => item !== undefined,
  );
  if (normalized.length > 0) {
    return normalized;
  }
  const legacy: TemplateSetting = {
    id: DEFAULT_TEMPLATE_ID,
    name: "Template 1",
    useDomainSubfolders:
      raw.useDomainSubfolders ?? DEFAULT_TEMPLATE_PRESET.useDomainSubfolders,
    singleFilePath: normalizeFileName(
      raw.singleFilePath ?? DEFAULT_TEMPLATE_PRESET.singleFilePath,
    ),
    categories: normalizeCategories(raw.categories ?? []),
    categoryAggregateFileName: normalizeFileName(
      raw.categoryAggregateFileName ??
        DEFAULT_TEMPLATE_PRESET.categoryAggregateFileName,
    ),
    frontMatter: {
      enabled: false,
      fields: [],
    },
    entryTemplate: DEFAULT_TEMPLATE_PRESET.entryTemplate,
    directoryTemplates: [],
    directoryCategorySettings: {},
  };
  return [legacy];
}

function normalizeTemplate(
  input: Partial<TemplateSetting>,
): TemplateSetting | undefined {
  const id = input.id?.trim() || crypto.randomUUID();
  const name = input.name?.trim() || "Template";
  const useDomainSubfolders = Boolean(
    input.useDomainSubfolders ?? DEFAULT_TEMPLATE_PRESET.useDomainSubfolders,
  );
  const singleFilePath = normalizeFileName(
    input.singleFilePath ?? DEFAULT_TEMPLATE_PRESET.singleFilePath,
  );
  const categoryAggregateFileName = normalizeFileName(
    input.categoryAggregateFileName ??
      DEFAULT_TEMPLATE_PRESET.categoryAggregateFileName,
  );
  const frontMatter = normalizeFrontMatter(input.frontMatter);
  const categories = normalizeCategories(input.categories ?? []);
  const entryTemplate =
    typeof input.entryTemplate === "string" && input.entryTemplate.trim()
      ? input.entryTemplate
      : DEFAULT_TEMPLATE_PRESET.entryTemplate;
  const directoryTemplates = Array.isArray(input.directoryTemplates)
    ? input.directoryTemplates
        .map(normalizeDirectoryTemplate)
        .filter(
          (dt): dt is import("./types").DirectoryTemplate => dt !== undefined,
        )
    : [];

  // directoryCategorySettingsのマイグレーション
  let directoryCategorySettings = input.directoryCategorySettings || {};
  if (
    Object.keys(directoryCategorySettings).length === 0 &&
    categories.length > 0
  ) {
    // 旧categoriesから変換
    directoryCategorySettings = {};
    for (const category of categories) {
      directoryCategorySettings[category.label] = {
        aggregate: category.aggregate,
        subfolders: category.subfolders,
      };
    }
  }

  return {
    id,
    name,
    useDomainSubfolders,
    singleFilePath,
    categories,
    categoryAggregateFileName,
    directoryCategorySettings,
    frontMatter,
    entryTemplate,
    directoryTemplates,
  };
}

function normalizeFileName(input: string): string {
  const trimmed = input?.trim();
  if (!trimmed) {
    return "inbox.md";
  }
  return trimmed;
}

function normalizeCategories(input: CategorySetting[]): CategorySetting[] {
  return (input ?? [])
    .map((item) => normalizeCategory(item))
    .filter((item): item is CategorySetting => item !== undefined);
}

function normalizeCategory(
  input: CategorySetting,
): CategorySetting | undefined {
  const label = input.label?.trim();
  if (!label) {
    return undefined;
  }
  const aggregate = Boolean(input.aggregate);
  const subfolders = Array.isArray(input.subfolders)
    ? input.subfolders
        .map((sub) => normalizeSubfolder(sub))
        .filter((sub): sub is CategorySubfolder => sub !== undefined)
    : [];
  return {
    id: input.id || crypto.randomUUID(),
    label,
    aggregate,
    subfolders,
  };
}

function normalizeSubfolder(
  input: Partial<CategorySubfolder>,
): CategorySubfolder | undefined {
  const name = input.name?.trim();
  if (!name) {
    return undefined;
  }
  return {
    id: input.id?.trim() || crypto.randomUUID(),
    name,
    aggregate: Boolean(input.aggregate),
  };
}

function normalizeFrontMatter(
  input: TemplateSetting["frontMatter"] | undefined,
): TemplateSetting["frontMatter"] {
  if (!input) {
    return {
      enabled: false,
      fields: [],
    };
  }
  const enabled = Boolean(input.enabled);
  const fields = Array.isArray(input.fields)
    ? input.fields
        .map((field) => normalizeFrontMatterField(field))
        .filter(
          (field): field is TemplateFrontMatterField => field !== undefined,
        )
    : [];
  return { enabled, fields };
}

function normalizeFrontMatterField(
  field: Partial<TemplateFrontMatterField>,
): TemplateFrontMatterField | undefined {
  const key = field.key?.trim();
  if (!key) {
    return undefined;
  }
  return {
    id: field.id?.trim() || crypto.randomUUID(),
    key,
    value: field.value ?? "",
    updateOnClip: Boolean(field.updateOnClip),
  };
}

function normalizeDirectoryTemplate(
  input: Partial<import("./types").DirectoryTemplate>,
): import("./types").DirectoryTemplate | undefined {
  const directoryPath = input.directoryPath?.trim();
  if (!directoryPath) {
    return undefined;
  }
  const frontMatter = normalizeFrontMatter(input.frontMatter);
  const entryTemplate =
    typeof input.entryTemplate === "string" && input.entryTemplate.trim()
      ? input.entryTemplate
      : DEFAULT_TEMPLATE_PRESET.entryTemplate;
  return {
    directoryPath,
    frontMatter,
    entryTemplate,
  };
}
