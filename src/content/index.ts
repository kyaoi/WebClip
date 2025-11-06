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
  const markdown = buildSelectionMarkdown(selection).trim();
  const selectionText = selection.toString().trim();
  if (!selectionText && !markdown) {
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
  const resolvedMarkdown = markdown || selectionText;
  const resolvedSelection = selectionText || resolvedMarkdown;
  const context: SelectionContext = {
    selection: resolvedSelection,
    markdown: resolvedMarkdown,
    baseUrl: sourceUrl.toString(),
    title: document.title || sourceUrl.hostname,
    createdAt: new Date().toISOString(),
    textFragmentUrl,
    link,
  };
  return context;
}

function buildSelectionMarkdown(selection: Selection): string {
  if (selection.rangeCount === 0) {
    return "";
  }
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  if (!fragment || fragment.childNodes.length === 0) {
    return selection.toString();
  }
  const container = document.createElement("div");
  container.append(fragment);
  sanitizeFragment(container);
  const markdown = serializeChildren(container, {
    listDepth: 0,
    blockquoteDepth: 0,
  });
  return markdown.trim();
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

interface MarkdownState {
  listDepth: number;
  blockquoteDepth: number;
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "NAV",
  "FIGURE",
  "FIGCAPTION",
  "PRE",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TD",
  "TH",
  "HR",
]);

function sanitizeFragment(container: HTMLElement): void {
  container.querySelectorAll("script, style, noscript").forEach((node) => {
    node.remove();
  });
  const base = document.baseURI;
  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }
    try {
      anchor.href = new URL(href, base).toString();
    } catch {
      // ignore invalid URLs
    }
  });
  container.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) {
      return;
    }
    try {
      img.src = new URL(src, base).toString();
    } catch {
      // ignore invalid URLs
    }
  });
}

function serializeChildren(
  parent: Node,
  state: MarkdownState,
  inlineContext = false,
): string {
  const parts: string[] = [];
  parent.childNodes.forEach((node) => {
    const part = serializeNode(node, state, inlineContext);
    if (part) {
      parts.push(part);
    }
  });
  const output = parts.join("");
  if (inlineContext) {
    return output;
  }
  return collapseBlankLines(output);
}

function serializeNode(
  node: Node,
  state: MarkdownState,
  inlineContext: boolean,
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return serializeText(node as Text, inlineContext);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node as HTMLElement;
  if (element.hidden) {
    return "";
  }
  switch (element.tagName) {
    case "BR":
      return "\n";
    case "P":
    case "DIV":
    case "SECTION":
    case "ARTICLE":
    case "HEADER":
    case "FOOTER":
    case "MAIN":
    case "ASIDE":
    case "NAV":
    case "FIGCAPTION": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `${content}\n\n`;
    }
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const level = Number.parseInt(element.tagName.slice(1), 10) || 1;
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `${"#".repeat(Math.min(level, 6))} ${content}\n\n`;
    }
    case "STRONG":
    case "B": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `**${content}**`;
    }
    case "EM":
    case "I": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `*${content}*`;
    }
    case "DEL": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `~~${content}~~`;
    }
    case "CODE": {
      if (element.parentElement?.tagName === "PRE") {
        return "";
      }
      const text = element.textContent ?? "";
      if (!text) {
        return "";
      }
      const normalized = text.replace(/\s+/g, " ");
      const fence = normalized.includes("`") ? "``" : "`";
      return `${fence}${normalized}${fence}`;
    }
    case "PRE":
      return serializeCodeBlock(element);
    case "A":
      return serializeLink(element as HTMLAnchorElement, state);
    case "IMG":
      return serializeImage(element as HTMLImageElement);
    case "UL":
      return serializeList(element, state, false);
    case "OL":
      return serializeList(element, state, true);
    case "LI": {
      const content = serializeChildren(element, {
        ...state,
        listDepth: state.listDepth + 1,
      }).trim();
      if (!content) {
        return "";
      }
      return `- ${content}\n`;
    }
    case "BLOCKQUOTE":
      return serializeBlockquote(element, state);
    case "HR":
      return "---\n\n";
    case "SPAN":
      return serializeChildren(element, state, inlineContext);
    default: {
      const isBlock = BLOCK_TAGS.has(element.tagName);
      const content = serializeChildren(element, state, !isBlock);
      return isBlock ? `${content.trim()}\n\n` : content;
    }
  }
}

function serializeText(node: Text, inlineContext: boolean): string {
  let text = node.textContent ?? "";
  if (!text) {
    return "";
  }
  text = text.replace(/\u00a0/g, " ");
  if (inlineContext) {
    text = text.replace(/\s+/g, " ");
  } else {
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  }
  return escapeMarkdownText(text);
}

function serializeLink(
  element: HTMLAnchorElement,
  state: MarkdownState,
): string {
  const href = element.getAttribute("href") ?? "";
  const text = serializeChildren(element, state, true).trim();
  const label = text || href;
  if (!href) {
    return label;
  }
  return `[${label}](${href})`;
}

function serializeImage(element: HTMLImageElement): string {
  const src = element.getAttribute("src");
  if (!src) {
    return "";
  }
  const alt =
    element.getAttribute("alt") ??
    element.getAttribute("title") ??
    element.getAttribute("aria-label") ??
    "";
  const escapedAlt = escapeMarkdownText(alt);
  return `![${escapedAlt}](${src})`;
}

function serializeCodeBlock(element: HTMLElement): string {
  const codeElement =
    element.firstElementChild instanceof HTMLElement &&
    element.firstElementChild.tagName === "CODE"
      ? (element.firstElementChild as HTMLElement)
      : null;
  const raw = codeElement?.textContent ?? element.textContent ?? "";
  const language = extractCodeLanguage(codeElement);
  const normalized = raw.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
  const trimmed = normalized.replace(/\s+$/g, "");
  const openingFence = language ? `\`\`\` ${language}` : "```";
  return `${openingFence}\n${trimmed}\n\`\`\`\n\n`;
}

function extractCodeLanguage(element: HTMLElement | null): string {
  if (!element) {
    return "";
  }
  const className = element.getAttribute("class") ?? "";
  const match = className.match(/language-([\w-]+)/i);
  if (match) {
    return match[1];
  }
  const dataLang =
    element.getAttribute("data-language") ??
    element.getAttribute("data-lang") ??
    "";
  return dataLang;
}

function serializeList(
  element: HTMLElement,
  state: MarkdownState,
  ordered: boolean,
): string {
  const items = Array.from(element.children).filter(
    (child): child is HTMLLIElement => child instanceof HTMLLIElement,
  );
  if (!items.length) {
    return "";
  }
  const indent = "  ".repeat(state.listDepth);
  const lines: string[] = [];
  items.forEach((item, index) => {
    const marker = ordered ? `${index + 1}. ` : "- ";
    const content = serializeChildren(item, {
      ...state,
      listDepth: state.listDepth + 1,
    }).trim();
    if (!content) {
      lines.push(`${indent}${marker}`.trimEnd());
      return;
    }
    const itemLines = content.split(/\n/);
    const first = itemLines.shift() ?? "";
    lines.push(`${indent}${marker}${first}`);
    itemLines.forEach((line) => {
      if (!line.trim()) {
        lines.push("");
      } else {
        lines.push(`${indent}  ${line}`);
      }
    });
  });
  return `${lines.join("\n")}\n\n`;
}

function serializeBlockquote(
  element: HTMLElement,
  state: MarkdownState,
): string {
  const depth = state.blockquoteDepth + 1;
  const content = serializeChildren(element, {
    ...state,
    blockquoteDepth: depth,
  }).trim();
  if (!content) {
    return "";
  }
  const prefix = ">".repeat(depth);
  const lines = content
    .split(/\n/)
    .map((line) => (line ? `${prefix} ${line}` : prefix));
  return `${lines.join("\n")}\n\n`;
}

function escapeMarkdownText(input: string): string {
  return input.replace(/[\\`*_{}[\]()#+!|<>]/g, "\\$&");
}

function collapseBlankLines(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n");
}
