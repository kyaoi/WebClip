import type { SelectionContext } from "../shared/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "webclip:get-selection") {
    return;
  }
  const context = collectSelectionContext();
  if (!context) {
    sendResponse({
      ok: false,
      error: "テキストが選択されていません。",
    });
    return;
  }
  sendResponse({
    ok: true,
    context,
  });
});

function collectSelectionContext(): SelectionContext | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }
  const selectionText = selection.toString().trim();
  if (!selectionText) {
    return undefined;
  }
  const link = findNearestLink(selection);
  const sourceUrl = new URL(window.location.href);
  const hash = sourceUrl.hash;
  if (hash.includes(":~:text=")) {
    const anchorPart = hash
      .slice(1, hash.indexOf(":~:text="))
      .replace(/&$/, "");
    sourceUrl.hash = anchorPart;
  }
  const textFragmentUrl = sourceUrl.toString();
  const context: SelectionContext = {
    selection: selectionText,
    baseUrl: sourceUrl.toString(),
    title: document.title || sourceUrl.hostname,
    createdAt: new Date().toISOString(),
    textFragmentUrl,
    link,
  };
  return context;
}

function findNearestLink(
  selection: Selection,
): SelectionContext["link"] | undefined {
  const range = selection.getRangeAt(0);
  const anchorElement = resolveAnchorElement(selection, range);
  if (anchorElement) {
    return toLink(anchorElement);
  }
  const commonContainer =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!commonContainer) {
    return undefined;
  }
  const candidate =
    (commonContainer.querySelector("a[href]") as HTMLAnchorElement | null) ??
    findSiblingAnchor(commonContainer);
  if (candidate) {
    return toLink(candidate);
  }
  return undefined;
}

function resolveAnchorElement(
  selection: Selection,
  range: Range,
): HTMLAnchorElement | null {
  const nodeCandidates = [
    selection.anchorNode,
    selection.focusNode,
    range.commonAncestorContainer,
  ];
  for (const node of nodeCandidates) {
    if (!node) {
      continue;
    }
    const element = node instanceof Element ? node : node.parentElement;
    const anchor = element?.closest("a[href]");
    if (anchor instanceof HTMLAnchorElement && anchor.href) {
      return anchor;
    }
  }
  return null;
}

function findSiblingAnchor(element: Element): HTMLAnchorElement | null {
  const parent = element.parentElement;
  if (!parent) {
    return null;
  }
  const anchors = parent.querySelectorAll("a[href]");
  return (anchors.item(0) as HTMLAnchorElement | null) ?? null;
}

function toLink(anchor: HTMLAnchorElement): SelectionContext["link"] {
  const href = anchor.href;
  const text = (anchor.textContent ?? "").trim().replace(/\s+/g, " ");
  return {
    href,
    text: text.slice(0, 120) || href,
  };
}
