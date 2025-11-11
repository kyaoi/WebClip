export type ClipMode =
  | "perPage"
  | "existingFilePick"
  | "singleFile"
  | "category";

export interface SelectionContext {
  selection: string;
  markdown: string;
  baseUrl: string;
  title: string;
  createdAt: string;
  textFragmentUrl: string;
}

export interface ClipTarget {
  /** Directory segments relative to the root handle. */
  path: string[];
  /** Markdown file name (must include .md). */
  fileName: string;
  /** Create parent directories and file if they are missing. */
  createIfMissing?: boolean;
}

export interface ClipPayload {
  context: SelectionContext;
  mode: ClipMode;
  target?: ClipTarget;
}

export type ClipResultStatus = "ok" | "duplicate" | "error";

export interface ClipResult {
  status: ClipResultStatus;
  message: string;
  filePath?: string;
  hash?: string;
}

export type ThemePreference = "system" | "light" | "dark";

export interface CategorySubfolder {
  id: string;
  name: string;
  aggregate: boolean;
}

export interface CategorySetting {
  id: string;
  label: string;
  folder: string;
  aggregate: boolean;
  subfolders: CategorySubfolder[];
}

export interface TemplateFrontMatterField {
  id: string;
  key: string;
  value: string;
  /** Update the value whenever a new clip is appended. */
  updateOnClip: boolean;
}

export interface TemplateFrontMatter {
  enabled: boolean;
  fields: TemplateFrontMatterField[];
}

export interface TemplateSetting {
  id: string;
  name: string;
  useDomainSubfolders: boolean;
  singleFilePath: string;
  categories: CategorySetting[];
  categoryAggregateFileName: string;
  frontMatter: TemplateFrontMatter;
  entryTemplate: string;
}

export interface Settings {
  theme: ThemePreference;
  mruFiles: string[];
  rootFolderName?: string;
  activeTemplateId: string;
  templates: TemplateSetting[];
}

export const DEFAULT_TEMPLATE_ID = "template-default";

export const DEFAULT_ENTRY_TEMPLATE = [
  "### {{time}}",
  "{{content}}",
  "",
  "### source: [{{title}}]({{url}})",
  "---",
].join("\n");

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  mruFiles: [],
  activeTemplateId: DEFAULT_TEMPLATE_ID,
  templates: [
    {
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
    },
  ],
};
