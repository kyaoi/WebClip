const MAX_SLUG_LENGTH = 80;

export function slugify(input: string): string {
  const normalized = input
    .normalize("NFKC")
    .replace(/\p{M}+/gu, "")
    .replace(/[/?#%]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  const trimmed = normalized.slice(0, MAX_SLUG_LENGTH);
  return trimmed.length > 0 ? trimmed : "note";
}

export function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function summarizeSelection(selection: string, max = 140): string {
  const trimmed = selection.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

export function domainSegmentsFromUrl(url: URL): string[] {
  const host = url.hostname.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  return [slugify(parts.join("-"))];
}
