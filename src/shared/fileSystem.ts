import { loadRootDirectoryHandle } from "./handles";
import type { ClipResult, ClipTarget } from "./types";

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
