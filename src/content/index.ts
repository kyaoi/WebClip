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
  "CAPTION",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "HR",
  "DETAILS",
  "SUMMARY",
  "DL",
  "DT",
  "DD",
]);

function sanitizeFragment(container: HTMLElement): void {
  const commentWalker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_COMMENT,
  );
  const comments: Comment[] = [];
  while (commentWalker.nextNode()) {
    const current = commentWalker.currentNode;
    if (current instanceof Comment) {
      comments.push(current);
    }
  }
  comments.forEach((comment) => {
    comment.remove();
  });
  container.querySelectorAll("script, style, noscript").forEach((node) => {
    node.remove();
  });
  container.querySelectorAll("picture").forEach((picture) => {
    const img = picture.querySelector("img");
    if (img) {
      picture.replaceWith(img);
    } else {
      picture.remove();
    }
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
    case "MARK": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `==${content}==`;
    }
    case "U": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `++${content}++`;
    }
    case "DEL": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `~~${content}~~`;
    }
    case "SUP": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `^${content}^`;
    }
    case "SUB": {
      const content = serializeChildren(element, state, true).trim();
      if (!content) {
        return "";
      }
      return `~${content}~`;
    }
    case "CODE": {
      if (element.parentElement?.tagName === "PRE") {
        return "";
      }
      return serializeInlineCode(element);
    }
    case "PRE":
      return serializeCodeBlock(element);
    case "A":
      return serializeLink(element as HTMLAnchorElement, state);
    case "IMG":
      return serializeImage(element as HTMLImageElement);
    case "VIDEO":
    case "AUDIO":
      return serializeMedia(element as HTMLMediaElement);
    case "UL":
      return serializeList(element, state, false);
    case "OL":
      return serializeList(element, state, true);
    case "LI":
      return serializeLooseListItem(element as HTMLLIElement, state);
    case "BLOCKQUOTE":
      return serializeBlockquote(element, state);
    case "DETAILS":
      return serializeDetails(element, state);
    case "SUMMARY": {
      const content = serializeChildren(element, state, true).trim();
      return content ? `**${content}**` : "";
    }
    case "FIGURE":
      return serializeFigure(element, state);
    case "TABLE":
      return serializeTable(element as HTMLTableElement, state);
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
  const label = serializeChildren(element, state, true).trim();
  if (!label) {
    return "";
  }
  if (!href) {
    return label;
  }
  const title = element.getAttribute("title") ?? "";
  const titlePart = title ? ` "${escapeAttributeValue(title)}"` : "";
  return `[${label}](${href}${titlePart})`;
}

function serializeImage(element: HTMLImageElement): string {
  const src = resolveImageSource(element);
  if (!src) {
    return "";
  }
  const alt =
    element.getAttribute("alt") ??
    element.getAttribute("title") ??
    element.getAttribute("aria-label") ??
    "";
  const escapedAlt = escapeMarkdownText(alt);
  const title = element.getAttribute("title") ?? "";
  const titlePart = title ? ` "${escapeAttributeValue(title)}"` : "";
  return `![${escapedAlt}](${src}${titlePart})`;
}

function resolveImageSource(element: HTMLImageElement): string {
  const base = document.baseURI;
  const attributeCandidates = [
    element.currentSrc,
    element.getAttribute("src"),
    element.getAttribute("data-src"),
    element.getAttribute("data-lazy-src"),
    element.getAttribute("data-original"),
    element.getAttribute("data-original-src"),
    element.getAttribute("data-zoom-src"),
    element.getAttribute("data-src-large"),
    element.getAttribute("data-src-full"),
    element.getAttribute("data-src-hd"),
    element.getAttribute("data-src-retina"),
    element.getAttribute("data-image"),
    element.getAttribute("data-image-src"),
    element.getAttribute("data-canonical-src"),
    element.getAttribute("data-hires"),
    element.getAttribute("data-medium-file"),
    element.getAttribute("data-large-file"),
    element.getAttribute("data-url"),
  ];
  const datasetCandidates = Object.entries(element.dataset ?? {})
    .filter(
      ([key, value]) => Boolean(value) && /src|source|image|url/i.test(key),
    )
    .map(([, value]) => value ?? "");
  const srcsetCandidates = [
    element.getAttribute("srcset"),
    element.getAttribute("data-srcset"),
    element.getAttribute("data-lazy-srcset"),
    element.getAttribute("data-responsive-srcset"),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) =>
      value
        .split(/\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.split(/\s+/)[0] ?? ""),
    )
    .filter(Boolean);
  const resolvedCandidates = [
    ...attributeCandidates,
    ...datasetCandidates,
    ...srcsetCandidates,
  ];
  for (const candidate of resolvedCandidates) {
    if (!candidate) {
      continue;
    }
    try {
      return new URL(candidate, base).toString();
    } catch {
      if (candidate.startsWith("data:")) {
        return candidate;
      }
      // ignore invalid URLs
    }
  }
  return "";
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
  const startIndex =
    ordered && element instanceof HTMLOListElement
      ? Number.parseInt(
          element.getAttribute("start") ?? `${element.start ?? 1}`,
          10,
        ) || 1
      : 1;
  const lines: string[] = [];
  items.forEach((item, index) => {
    const order = ordered ? startIndex + index : index + 1;
    const itemLines = serializeListItem(item, state, ordered, order);
    lines.push(...itemLines);
  });
  if (!lines.length) {
    return "";
  }
  return `${lines.join("\n")}\n\n`;
}

function serializeListItem(
  item: HTMLLIElement,
  state: MarkdownState,
  ordered: boolean,
  order: number,
): string[] {
  const indent = "  ".repeat(state.listDepth);
  const marker = ordered ? `${order}. ` : "- ";
  const clone = item.cloneNode(true) as HTMLLIElement;
  const task = extractTaskInfo(clone);
  const content = serializeChildren(clone, {
    ...state,
    listDepth: state.listDepth + 1,
  })
    .replace(/^[\n\r]+/, "")
    .replace(/[\n\r]+$/, "");
  if (!content.trim()) {
    return [`${indent}${marker}${task.prefix}`.trimEnd()];
  }
  const lines = content.split(/\n/);
  const firstLine = lines.shift() ?? "";
  const baseIndent = indent + " ".repeat(marker.length + task.prefix.length);
  const output: string[] = [];
  output.push(`${indent}${marker}${task.prefix}${firstLine}`.trimEnd());
  lines.forEach((line) => {
    if (!line.trim()) {
      output.push("");
      return;
    }
    const normalized = line.replace(/[\s\u00a0]+$/g, "");
    if (/^\s/.test(normalized)) {
      output.push(normalized);
    } else {
      output.push(`${baseIndent}${normalized}`);
    }
  });
  return output;
}

function serializeLooseListItem(
  item: HTMLLIElement,
  state: MarkdownState,
): string {
  const lines = serializeListItem(item, state, false, 1);
  if (!lines.length) {
    return "";
  }
  return `${lines.join("\n")}\n`;
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

function serializeInlineCode(element: HTMLElement): string {
  const text = element.textContent ?? "";
  const normalized = text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((item) => item.length)) + 1
    : 1;
  const fence = "`".repeat(fenceLength);
  return `${fence}${normalized}${fence}`;
}

function serializeMedia(element: HTMLMediaElement): string {
  const src = element.currentSrc || element.getAttribute("src");
  if (!src) {
    return "";
  }
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    element.getAttribute("alt") ??
    element.tagName.toLowerCase();
  return `[${escapeMarkdownText(label)}](${src})`;
}

function serializeDetails(element: HTMLElement, state: MarkdownState): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const summary = clone.querySelector("summary");
  const summaryText = summary
    ? serializeChildren(summary, state, true).trim()
    : "";
  summary?.remove();
  const body = serializeChildren(clone, state, false)
    .replace(/^[\n\r]+/, "")
    .trim();
  const lines: string[] = [];
  lines.push(summaryText ? `> [!details] ${summaryText}` : "> [!details]");
  if (body) {
    body.split(/\n/).forEach((line) => {
      lines.push(line ? `> ${line}` : ">");
    });
  }
  return `${lines.join("\n")}\n\n`;
}

function serializeFigure(element: HTMLElement, state: MarkdownState): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const caption = clone.querySelector("figcaption");
  const captionText = caption
    ? serializeChildren(caption, state, true).trim()
    : "";
  caption?.remove();
  const content = serializeChildren(clone, state, false).trim();
  if (!content) {
    return captionText ? `${captionText}\n\n` : "";
  }
  if (captionText) {
    return `${content}\n\n${captionText}\n\n`;
  }
  return `${content}\n\n`;
}

function serializeTable(table: HTMLTableElement, state: MarkdownState): string {
  const rows = Array.from(
    table.querySelectorAll("tr"),
  ) as HTMLTableRowElement[];
  const filtered = rows.filter((row) => row.cells.length > 0);
  if (!filtered.length) {
    return "";
  }
  const headerIndex = filtered.findIndex((row) =>
    Array.from(row.cells).some((cell) => cell.tagName === "TH"),
  );
  const workingRows = [...filtered];
  const headerRow =
    headerIndex >= 0
      ? workingRows.splice(headerIndex, 1)[0]
      : workingRows.shift();
  if (!headerRow) {
    return "";
  }
  const headerCells = expandTableRow(headerRow, state);
  const alignments = expandAlignmentRow(headerRow);
  const bodyRows = workingRows.map((row) => expandTableRow(row, state));
  const columnCount = Math.max(
    headerCells.length,
    ...bodyRows.map((row) => row.length),
  );
  const headerLine = `| ${padRow(headerCells, columnCount).join(" | ")} |`;
  const dividerLine = `| ${padAlignment(alignments, columnCount).join(" | ")} |`;
  const bodyLines = bodyRows.map(
    (row) => `| ${padRow(row, columnCount).join(" | ")} |`,
  );
  const lines = [headerLine, dividerLine, ...bodyLines];
  return `${lines.join("\n")}\n\n`;
}

function expandTableRow(
  row: HTMLTableRowElement,
  state: MarkdownState,
): string[] {
  const result: string[] = [];
  Array.from(row.cells).forEach((cell) => {
    const htmlCell = cell as HTMLTableCellElement;
    const span = Math.max(1, htmlCell.colSpan || 1);
    const content = serializeTableCell(htmlCell, state) || " ";
    for (let index = 0; index < span; index += 1) {
      result.push(content);
    }
  });
  return result;
}

function expandAlignmentRow(row: HTMLTableRowElement): string[] {
  const result: string[] = [];
  Array.from(row.cells).forEach((cell) => {
    const htmlCell = cell as HTMLTableCellElement;
    const span = Math.max(1, htmlCell.colSpan || 1);
    const alignment = resolveAlignment(htmlCell);
    for (let index = 0; index < span; index += 1) {
      result.push(alignment);
    }
  });
  return result;
}

function padRow(row: string[], size: number): string[] {
  const output = [...row];
  while (output.length < size) {
    output.push(" ");
  }
  return output;
}

function padAlignment(row: string[], size: number): string[] {
  const output = [...row];
  while (output.length < size) {
    output.push("---");
  }
  return output.map((value) => (value ? value : "---"));
}

function serializeTableCell(
  cell: HTMLTableCellElement,
  state: MarkdownState,
): string {
  const content = serializeChildren(cell, state, false)
    .replace(/^[\n\r]+/, "")
    .replace(/[\n\r]+$/, "")
    .trim();
  if (!content) {
    return " ";
  }
  return content.replace(/\n+/g, "<br>");
}

function resolveAlignment(cell: HTMLTableCellElement): string {
  const alignmentSources = [cell.getAttribute("align"), cell.style.textAlign];
  try {
    alignmentSources.push(window.getComputedStyle(cell).textAlign);
  } catch {
    // ignore access errors
  }
  const alignment = alignmentSources
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
    .find((value) =>
      ["left", "center", "right", "start", "end"].includes(value),
    );
  switch (alignment) {
    case "center":
      return ":---:";
    case "right":
    case "end":
      return "---:";
    case "left":
    case "start":
      return ":---";
    default:
      return "---";
  }
}

function extractTaskInfo(item: HTMLLIElement): { prefix: string } {
  const checkbox = item.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!checkbox || checkbox.closest("li") !== item) {
    return { prefix: "" };
  }
  const checked =
    checkbox.checked ||
    checkbox.getAttribute("checked") !== null ||
    checkbox.getAttribute("aria-checked") === "true";
  checkbox.remove();
  return { prefix: `[${checked ? "x" : " "}] ` };
}

function escapeAttributeValue(value: string): string {
  return escapeMarkdownText(value).replace(/"/g, '\\"');
}

function escapeMarkdownText(input: string): string {
  return input.replace(/[\\`*_{}[\]()#+!|<>]/g, "\\$&");
}

function collapseBlankLines(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n");
}
