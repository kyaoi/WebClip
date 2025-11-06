import { appendEntry, clipTargetFromPath } from "../shared/fileSystem";
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
const MENU_SINGLE_FILE = "webclip:context:single-file";
const MENU_CATEGORY = "webclip:context:category";
const MENU_EXISTING = "webclip:context:existing";
const PICKER_URL = chrome.runtime.getURL("src/picker/index.html");
const CATEGORY_PICKER_URL = chrome.runtime.getURL("src/category/index.html");

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
  let mode: ClipMode | null = null;
  switch (info.menuItemId) {
    case MENU_PER_PAGE:
      mode = "perPage";
      break;
    case MENU_SINGLE_FILE:
      mode = "singleFile";
      break;
    case MENU_CATEGORY:
      mode = "category";
      break;
    case MENU_EXISTING:
      mode = "existingFilePick";
      break;
    default:
      return;
  }
  try {
    const context = await requestSelectionContext(tab.id);
    if (!context.selection.trim()) {
      await showNotification("WebClip", "テキストが選択されていません。");
      return;
    }
    switch (mode) {
      case "perPage":
        await handlePerPageClip(context);
        break;
      case "singleFile":
        await handleSingleFileClip(context);
        break;
      case "category":
        await handleCategoryClip(tab.id, context);
        break;
      case "existingFilePick":
        await handleExistingFileClip(tab.id, context);
        break;
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
      if (!pending || pending.mode !== "existingFilePick") {
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
      if (!pending || pending.mode !== "existingFilePick") {
        sendResponse({
          ok: false,
          error: "保存リクエストが見つかりませんでした。",
        });
        return;
      }
      const { context, pickerWindowId } = pending;
      const target = clipTargetFromPath(path, createIfMissing);
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
      if (!pending || pending.mode !== "existingFilePick") {
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
  if (message.type === "webclip:category:init") {
    const { requestId } = message as { requestId: string };
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending || pending.mode !== "category") {
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
  if (message.type === "webclip:category:save") {
    const { requestId, categoryId, mode } = message as {
      requestId: string;
      categoryId: string;
      mode?: "aggregate" | "page";
    };
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending || pending.mode !== "category") {
        sendResponse({
          ok: false,
          error: "保存リクエストが見つかりませんでした。",
        });
        return;
      }
      const { context, pickerWindowId } = pending;
      const settings = await getSettings();
      const category = settings.categories.find(
        (item) => item.id === categoryId,
      );
      if (!category) {
        sendResponse({
          ok: false,
          error: "カテゴリが見つかりませんでした。",
        });
        return;
      }
      const fileBase = slugify(context.title);
      const useAggregate = mode ? mode === "aggregate" : category.aggregate;
      const folderPrefix = category.folder ? `${category.folder}/` : "";
      const pathString = useAggregate
        ? `${folderPrefix}${settings.categoryAggregateFileName}`
        : `${folderPrefix}${fileBase}.md`;
      const target = clipTargetFromPath(pathString, true);
      const displayPath = [...target.path, target.fileName].join("/");
      const result = await processClipWithTarget(context, target);
      await finalizeRequest(requestId, result, displayPath);
      sendResponse({ ok: true, result });
      if (pickerWindowId !== undefined) {
        await removeWindow(pickerWindowId);
      }
    })();
    return true;
  }
  if (message.type === "webclip:category:cancel") {
    const { requestId } = message as { requestId: string };
    void (async () => {
      const pending = pendingRequests.get(requestId);
      if (!pending || pending.mode !== "category") {
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
      title: "Save to Markdown (per page)",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_SINGLE_FILE,
      title: "Save to inbox file",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_CATEGORY,
      title: "Save to category…",
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

async function handleSingleFileClip(context: SelectionContext): Promise<void> {
  const settings = await getSettings();
  const path = settings.singleFilePath.trim();
  if (!path) {
    await showNotification(
      "WebClip",
      "単一ファイルの保存先が設定されていません。オプションで設定してください。",
    );
    return;
  }
  const target = clipTargetFromPath(path, true);
  const displayPath = [...target.path, target.fileName].join("/");
  const result = await processClipWithTarget(context, target);
  await notifyClipResult(context, result, displayPath);
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

async function handleCategoryClip(
  tabId: number,
  context: SelectionContext,
): Promise<void> {
  const settings = await getSettings();
  if (!settings.categories.length) {
    await showNotification(
      "WebClip",
      "カテゴリが設定されていません。オプションで追加してください。",
    );
    return;
  }
  const requestId = crypto.randomUUID();
  pendingRequests.set(requestId, {
    context,
    mode: "category",
    tabId,
  });
  const url = new URL(CATEGORY_PICKER_URL);
  url.searchParams.set("requestId", requestId);
  const summary = summarizeSelection(context.selection, 80);
  url.searchParams.set("preview", summary);
  try {
    const windowId = await createPickerWindow(url.toString());
    const pending = pendingRequests.get(requestId);
    if (pending) {
      pending.pickerWindowId = windowId;
    }
  } catch (error) {
    pendingRequests.delete(requestId);
    throw error;
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
                "選択ウィンドウを開けませんでした。",
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
  const hash = await sha1Hex(`${context.markdown}|${context.baseUrl}`);
  const entry = buildMarkdownEntry(context);
  const result = await appendEntry(target, entry, hash);
  if (result.status === "ok" && result.filePath) {
    await pushMruEntry(result.filePath);
  }
  return result;
}

function buildMarkdownEntry(context: SelectionContext): string {
  const timestamp = formatTimestamp(new Date(context.createdAt));
  const content = context.markdown.trim();
  const bodySections: string[] = [];
  if (content) {
    bodySections.push(content);
  }
  if (context.link) {
    const linkText = context.link.text.trim() || context.link.href;
    bodySections.push(`- link: [${linkText}](${context.link.href})`);
  }
  const lines = [`### ${timestamp}`, "---"];
  if (bodySections.length > 0) {
    lines.push(bodySections.join("\n\n"));
  }
  lines.push(
    "",
    "---",
    `### source: [${context.title}](${context.textFragmentUrl})`,
    "---",
  );
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
