export type ClipMode =
  | "perPage"
  | "existingFilePick"
  | "singleFile"
  | "category";

export interface SelectionContext {
  selection: string;
  baseUrl: string;
  title: string;
  createdAt: string;
  textFragmentUrl: string;
  link?: {
    text: string;
    href: string;
  };
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

export interface CategorySetting {
  id: string;
  label: string;
  folder: string;
  aggregate: boolean;
}

export interface Settings {
  theme: ThemePreference;
  useDomainSubfolders: boolean;
  mruFiles: string[];
  rootFolderName?: string;
  singleFilePath: string;
  categories: CategorySetting[];
  categoryAggregateFileName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  useDomainSubfolders: true,
  mruFiles: [],
  singleFilePath: "inbox.md",
  categories: [],
  categoryAggregateFileName: "inbox.md",
};
