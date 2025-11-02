import { appendEntry } from "../shared/fileSystem";
import {
  domainSegmentsFromUrl,
  formatTimestamp,
  slugify,
  summarizeSelection,
} from "../shared/format";
import { sha1Hex } from "../shared/hash";
import { getSettings, pushMruEntry } from "../shared/settings";
import type {
  ClipMode,
  ClipResult,
  ClipTarget,
  SelectionContext,
} from "../shared/types";

const MENU_PER_PAGE = "webclip:context:per-page";
const MENU_EXISTING = "webclip:context:existing";
const PICKER_URL = chrome.runtime.getURL("src/picker/index.html");

interface PendingRequest {
  context: SelectionContext;
  tabId: number;
  mode: ClipMode;
  pickerWindowId?: number;
}

const pendingRequests = new Map<string, PendingRequest>();

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.runtime.onStartup?.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    return;
  }
  if (info.menuItemId !== MENU_PER_PAGE && info.menuItemId !== MENU_EXISTING) {
    return;
  }
  const mode =
    info.menuItemId === MENU_PER_PAGE ? "perPage" : "existingFilePick";
  try {
    const context = await requestSelectionContext(tab.id);
    if (!context.selection.trim()) {
      await showNotification("WebClip", "テキストが選択されていません。");
      return;
    }
    if (mode === "perPage") {
      await handlePerPageClip(context);
    } else {
      await handleExistingFileClip(tab.id, context);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "選択内容の取得に失敗しました。";
    await showNotification("WebClip", message);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "webclip:picker:init") {
    const { requestId } = message as { requestId: string };
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        sendResponse({
          ok: false,
          error: "保存リクエストが見つかりませんでした。",
        });
        return;
      }
      const settings = await getSettings();
      sendResponse({
        ok: true,
        context: pending.context,
        settings,
      });
    })();
    return true;
  }
  if (message.type === "webclip:picker:save") {
    const {
      requestId,
      path,
      createIfMissing,
    }: { requestId: string; path: string; createIfMissing: boolean } = message;
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        sendResponse({
          ok: false,
          error: "保存リクエストが見つかりませんでした。",
        });
        return;
      }
      const { context, pickerWindowId } = pending;
      const target = buildTargetFromPath(path, createIfMissing);
      const result = await processClipWithTarget(context, target);
      await finalizeRequest(requestId, result, path);
      sendResponse({ ok: true, result });
      if (pickerWindowId !== undefined) {
        await removeWindow(pickerWindowId);
      }
    })();
    return true;
  }
  if (message.type === "webclip:picker:cancel") {
    const { requestId }: { requestId: string } = message;
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        sendResponse({ ok: false });
        return;
      }
      const { pickerWindowId } = pending;
      pendingRequests.delete(requestId);
      if (pickerWindowId !== undefined) {
        await removeWindow(pickerWindowId);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});

function setupContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PER_PAGE,
      title: "Save to Markdown",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_EXISTING,
      title: "Save to existing file…",
      contexts: ["selection"],
    });
  });
}

async function requestSelectionContext(
  tabId: number,
): Promise<SelectionContext> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "webclip:get-selection" },
      (response: {
        ok: boolean;
        context?: SelectionContext;
        error?: string;
      }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("コンテンツスクリプトから応答がありません。"));
          return;
        }
        if (!response.ok || !response.context) {
          reject(
            new Error(response.error ?? "選択内容を取得できませんでした。"),
          );
          return;
        }
        resolve(response.context);
      },
    );
  });
}

async function handlePerPageClip(context: SelectionContext): Promise<void> {
  const result = await processClipDefaultTarget(context);
  await notifyClipResult(context, result);
}

async function handleExistingFileClip(
  tabId: number,
  context: SelectionContext,
): Promise<void> {
  const requestId = crypto.randomUUID();
  pendingRequests.set(requestId, {
    context,
    mode: "existingFilePick",
    tabId,
  });
  const url = new URL(PICKER_URL);
  url.searchParams.set("requestId", requestId);
  const summary = summarizeSelection(context.selection, 80);
  url.searchParams.set("preview", summary);
  const windowId = await createPickerWindow(url.toString());
  const pending = pendingRequests.get(requestId);
  if (pending) {
    pending.pickerWindowId = windowId;
  }
}

async function createPickerWindow(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.windows.create(
      {
        url,
        type: "popup",
        width: 460,
        height: 640,
      },
      (window) => {
        if (chrome.runtime.lastError || !window?.id) {
          reject(
            new Error(
              chrome.runtime.lastError?.message ??
                "ファイル選択ウィンドウを開けませんでした。",
            ),
          );
          return;
        }
        resolve(window.id);
      },
    );
  });
}

async function removeWindow(windowId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.windows.remove(windowId, () => resolve());
  });
}

function buildTargetFromPath(
  path: string,
  createIfMissing: boolean,
): ClipTarget {
  const segments = path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return {
      path: [],
      fileName: "note.md",
      createIfMissing,
    };
  }
  const fileName = segments.pop() ?? "note.md";
  return {
    path: segments,
    fileName,
    createIfMissing,
  };
}

async function processClipDefaultTarget(
  context: SelectionContext,
): Promise<ClipResult> {
  const url = new URL(context.baseUrl);
  const settings = await getSettings();
  const pathSegments = settings.useDomainSubfolders
    ? domainSegmentsFromUrl(url)
    : [];
  const fileName = `${slugify(context.title)}.md`;
  const target: ClipTarget = {
    path: pathSegments,
    fileName,
    createIfMissing: true,
  };
  return processClipWithTarget(context, target);
}

async function processClipWithTarget(
  context: SelectionContext,
  target: ClipTarget,
): Promise<ClipResult> {
  const hash = await sha1Hex(`${context.selection}|${context.baseUrl}`);
  const entry = buildMarkdownEntry(context);
  const result = await appendEntry(target, entry, hash);
  if (result.status === "ok" && result.filePath) {
    await pushMruEntry(result.filePath);
  }
  return result;
}

function buildMarkdownEntry(context: SelectionContext): string {
  const timestamp = formatTimestamp(new Date(context.createdAt));
  const quoteLines = context.selection
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  const lines = [`### ${timestamp}`, quoteLines, ""];
  lines.push(`- source: [${context.title}](${context.textFragmentUrl})`);
  if (context.link) {
    const linkText = context.link.text.trim() || context.link.href;
    lines.push(`- link: [${linkText}](${context.link.href})`);
  }
  return lines.join("\n");
}

async function finalizeRequest(
  requestId: string,
  result: ClipResult,
  rawPath?: string,
): Promise<void> {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }
  pendingRequests.delete(requestId);
  await notifyClipResult(pending.context, result, rawPath);
}

async function notifyClipResult(
  context: SelectionContext,
  result: ClipResult,
  rawPath?: string,
): Promise<void> {
  const selectionSummary = summarizeSelection(context.selection, 100);
  if (result.status === "ok") {
    const detail =
      rawPath ?? result.filePath ?? "Markdownファイルへ追記しました。";
    await showNotification("WebClip", `${detail}\n${selectionSummary}`);
    return;
  }
  if (result.status === "duplicate") {
    await showNotification(
      "WebClip",
      `重複しているためスキップしました。\n${selectionSummary}`,
    );
    return;
  }
  await showNotification("WebClip", result.message);
}

async function showNotification(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.notifications.create(
      "",
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message,
      },
      () => resolve(),
    );
  });
}
