import { loadRootDirectoryHandle } from "./handles";
import { createTemplateVariables, renderFrontMatterValue } from "./template";
import type {
  ClipResult,
  ClipTarget,
  SelectionContext,
  TemplateFrontMatterField,
  TemplateSetting,
} from "./types";

const MARKDOWN_EXTENSION = ".md";

function ensureMarkdownExtension(fileName: string): string {
  if (fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    return fileName;
  }
  return `${fileName}${MARKDOWN_EXTENSION}`;
}

export async function listMarkdownFiles(): Promise<string[]> {
  const root = await loadRootDirectoryHandle({ requestAccess: true });
  if (!root) {
    return [];
  }
  const files: string[] = [];
  await traverse(root, "", files);
  return files.sort((a, b) => a.localeCompare(b, "ja"));
}

export async function listFolders(): Promise<string[]> {
  const root = await loadRootDirectoryHandle({ requestAccess: true });
  if (!root) {
    return [];
  }
  const folders: string[] = [];
  await traverseFolders(root, "", folders);
  return folders.sort((a, b) => a.localeCompare(b, "ja"));
}

async function traverse(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  output: string[],
): Promise<void> {
  if (!dir.values) {
    return;
  }
  for await (const handle of dir.values()) {
    const name = handle.name;
    if (handle.kind === "directory") {
      await traverse(
        handle as FileSystemDirectoryHandle,
        `${prefix}${name}/`,
        output,
      );
    } else if (handle.kind === "file" && name.toLowerCase().endsWith(".md")) {
      output.push(`${prefix}${name}`);
    }
    if (output.length >= 500) {
      // Hard cap to avoid huge lists; good enough for picker search.
      return;
    }
  }
}

async function traverseFolders(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  output: string[],
): Promise<void> {
  if (!dir.values) {
    return;
  }
  for await (const handle of dir.values()) {
    if (handle.kind === "directory") {
      const current = `${prefix}${handle.name}`;
      output.push(current);
      if (output.length >= 500) {
        return;
      }
      await traverseFolders(
        handle as FileSystemDirectoryHandle,
        `${current}/`,
        output,
      );
      if (output.length >= 500) {
        return;
      }
    }
  }
}

export async function resolveTargetHandle(
  target: ClipTarget,
): Promise<FileSystemFileHandle | undefined> {
  const root = await loadRootDirectoryHandle({ requestAccess: true });
  if (!root) {
    return undefined;
  }
  const fileName = ensureMarkdownExtension(target.fileName);
  let current: FileSystemDirectoryHandle = root;
  for (const segment of target.path) {
    current = await current.getDirectoryHandle(segment, {
      create: target.createIfMissing ?? false,
    });
  }
  return current.getFileHandle(fileName, {
    create: target.createIfMissing ?? false,
  });
}

export function clipTargetFromPath(
  path: string,
  createIfMissing = false,
): ClipTarget {
  const segments = path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!segments.length) {
    return {
      path: [],
      fileName: ensureMarkdownExtension("note.md"),
      createIfMissing,
    };
  }
  const fileName = segments.pop() ?? "note.md";
  return {
    path: segments,
    fileName: ensureMarkdownExtension(fileName),
    createIfMissing,
  };
}

async function readFileText(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

async function writeFileText(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function appendEntry(
  target: ClipTarget,
  entry: string,
  hash: string,
  options: {
    context: SelectionContext;
    template: TemplateSetting;
  },
): Promise<ClipResult> {
  const fileHandle = await resolveTargetHandle(target);
  if (!fileHandle) {
    return {
      status: "error",
      message:
        "保存フォルダが見つかりませんでした。オプションで再設定してください。",
    };
  }
  let existing = "";
  try {
    existing = await readFileText(fileHandle);
    if (existing.includes(`webclip:sha1=${hash}`)) {
      return {
        status: "duplicate",
        message: "同じクリップが既に存在します。",
      };
    }
  } catch {
    // ignore read errors and continue with empty content
  }
  const template = options.template;
  const variables = createTemplateVariables(options.context, { target });
  if (template.frontMatter.enabled && template.frontMatter.fields.length > 0) {
    existing = ensureFrontMatter(
      existing,
      template.frontMatter.fields,
      variables,
    );
  }
  const separator = existing.trim().length > 0 ? "\n\n" : "";
  const nextContent = `${existing}${separator}${entry}\n<!-- webclip:sha1=${hash} -->\n`;
  await writeFileText(fileHandle, nextContent);
  return {
    status: "ok",
    message: "Markdownに保存しました。",
    filePath: [...target.path, ensureMarkdownExtension(target.fileName)].join(
      "/",
    ),
    hash,
  };
}

function ensureFrontMatter(
  existing: string,
  fields: TemplateFrontMatterField[],
  variables: ReturnType<typeof createTemplateVariables>,
): string {
  if (!fields.length) {
    return existing;
  }
  const hasBom = existing.startsWith("\ufeff");
  const content = hasBom ? existing.slice(1) : existing;
  const parsed = splitFrontMatter(content);
  const activeFields = fields.filter((field) => field.key.trim().length > 0);
  if (!activeFields.length) {
    return existing;
  }
  let nextBody: string;
  let lines: string[];
  if (parsed.hasFrontMatter) {
    lines = mergeFrontMatterLines(parsed.lines, activeFields, variables);
    nextBody = parsed.body;
  } else {
    lines = activeFields.map(
      (field) => `${field.key}: ${renderFrontMatterValue(field, variables)}`,
    );
    nextBody = content.replace(/^\s*/, "");
  }
  const frontMatterBlock = `---\n${lines.join("\n")}\n---\n`;
  const bodySuffix = nextBody.length > 0 ? `\n${nextBody}` : "";
  const result = `${frontMatterBlock}${bodySuffix}`;
  return hasBom ? `\ufeff${result}` : result;
}

type TemplateVariablesType = ReturnType<typeof createTemplateVariables>;

interface FrontMatterParts {
  hasFrontMatter: boolean;
  lines: string[];
  body: string;
}

function splitFrontMatter(content: string): FrontMatterParts {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---")) {
    return { hasFrontMatter: false, lines: [], body: normalized };
  }
  if (!normalized.startsWith("---\n")) {
    return { hasFrontMatter: false, lines: [], body: normalized };
  }
  // Find the closing delimiter: must be "\n---\n" or "\n---" at EOF
  let closingIndex = -1;
  let searchIndex = 4;
  while (searchIndex < normalized.length) {
    const idx = normalized.indexOf("\n---", searchIndex);
    if (idx === -1) break;
    // Check if followed by newline or is at EOF
    if (
      (idx + 4 < normalized.length && normalized[idx + 4] === "\n") ||
      (idx + 4 === normalized.length)
    ) {
      closingIndex = idx;
      break;
    }
    searchIndex = idx + 1;
  }
  if (closingIndex === -1) {
    return { hasFrontMatter: false, lines: [], body: normalized };
  }
  const frontMatterContent = normalized.slice(4, closingIndex);
  let remainder = normalized.slice(closingIndex + 4);
  if (remainder.startsWith("\n")) remainder = remainder.slice(1);
  const body = remainder;
  const lines =
    frontMatterContent.length > 0 ? frontMatterContent.split("\n") : [];
  return { hasFrontMatter: true, lines, body };
}

function mergeFrontMatterLines(
  existingLines: string[],
  fields: TemplateFrontMatterField[],
  variables: TemplateVariablesType,
): string[] {
  const baseLines = existingLines.some((line) => line.trim().length > 0)
    ? [...existingLines]
    : [];
  const indexMap = new Map<string, number>();
  baseLines.forEach((line, index) => {
    const match = line.match(/^([^:#]+):\s*(.*)$/);
    if (match) {
      indexMap.set(match[1].trim(), index);
    }
  });
  for (const field of fields) {
    const renderedValue = renderFrontMatterValue(field, variables);
    const newLine = `${field.key}: ${renderedValue}`;
    const existingIndex = indexMap.get(field.key);
    if (existingIndex !== undefined) {
      const currentLine = baseLines[existingIndex] ?? "";
      const currentMatch = currentLine.match(/^([^:#]+):\s*(.*)$/);
      const currentValue = currentMatch?.[2]?.trim() ?? "";
      if (field.updateOnClip || currentValue.length === 0) {
        baseLines[existingIndex] = newLine;
      }
    } else {
      indexMap.set(field.key, baseLines.length);
      baseLines.push(newLine);
    }
  }
  return baseLines;
}
