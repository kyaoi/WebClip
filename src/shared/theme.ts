import type { ThemePreference } from "./types";

let mediaQuery: MediaQueryList | undefined;
let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;
let currentTheme: ThemePreference = "system";

export function applyTheme(theme: ThemePreference): void {
  currentTheme = theme;
  ensureMediaListener();
  updateDocumentTheme();
}

function ensureMediaListener(): void {
  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    console.log("Media query for prefers-color-scheme initialized.");
  }
  if (mediaListener) {
    mediaQuery?.removeEventListener("change", mediaListener);
    mediaListener = undefined;
    console.log("Previous media listener removed.");
  }
  if (currentTheme === "system" && mediaQuery) {
    mediaListener = () => updateDocumentTheme();
    mediaQuery.addEventListener("change", mediaListener);
    console.log("Media listener for system theme changes added.");
  }
}

function updateDocumentTheme(): void {
  const prefersDark = mediaQuery?.matches ?? false;
  const useDark =
    currentTheme === "dark" || (currentTheme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
  document.documentElement.dataset.theme = currentTheme;
  console.log(`Theme applied: ${currentTheme} (dark mode: ${useDark})`);
}
