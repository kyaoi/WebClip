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

// ディレクトリベースのカテゴリ設定
export interface DirectoryCategoryConfig {
  aggregate: boolean;
  subfolders: CategorySubfolder[];
}

// 旧CategorySetting（後方互換性のため残す）
export interface CategorySetting {
  id: string;
  label: string;
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

export interface DirectoryTemplate {
  directoryPath: string;
  frontMatter: TemplateFrontMatter;
  entryTemplate: string;
}

export interface TemplateSetting {
  id: string;
  name: string;
  useDomainSubfolders: boolean;
  singleFilePath: string;
  categories: CategorySetting[]; // 後方互換性のため保持
  categoryAggregateFileName: string;
  directoryCategorySettings: Record<string, DirectoryCategoryConfig>; // 新: ディレクトリベースのカテゴリ設定
  frontMatter: TemplateFrontMatter;
  entryTemplate: string;
  directoryTemplates: DirectoryTemplate[];
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
      directoryCategorySettings: {},
      frontMatter: {
        enabled: false,
        fields: [],
      },
      entryTemplate: DEFAULT_ENTRY_TEMPLATE,
      directoryTemplates: [],
    },
  ],
};
