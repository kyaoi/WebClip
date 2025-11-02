import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  clearRootDirectoryHandle,
  loadRootDirectoryHandle,
  saveRootDirectoryHandle,
} from "../shared/handles";
import { getSettings, updateSettings } from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type { Settings, ThemePreference } from "../shared/types";

function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      try {
        const handle = await loadRootDirectoryHandle({ requestAccess: false });
        setFolderName(handle?.name ?? null);
      } catch (error) {
        console.warn("Failed to load directory handle", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);

  const folderLabel = useMemo(() => {
    if (folderName) {
      return folderName;
    }
    if (settings?.rootFolderName) {
      return `${settings.rootFolderName}（権限が必要です）`;
    }
    return "未設定";
  }, [folderName, settings]);

  async function chooseFolder(): Promise<void> {
    if (busy) {
      return;
    }
    try {
      setBusy(true);
      const picker = (
        window as unknown as {
          showDirectoryPicker?: (
            options?: unknown,
          ) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;
      if (!picker) {
        setStatus("このブラウザではフォルダ選択がサポートされていません。");
        return;
      }
      const handle = await picker({ mode: "readwrite" });
      await saveRootDirectoryHandle(handle);
      const updated = await updateSettings({
        rootFolderName: handle.name,
      });
      setSettings(updated);
      setFolderName(handle.name);
      setStatus("保存先フォルダを更新しました。");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        setStatus("フォルダ選択をキャンセルしました。");
      } else {
        setStatus("フォルダの選択に失敗しました。");
        console.error(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearFolder(): Promise<void> {
    if (busy) {
      return;
    }
    try {
      setBusy(true);
      await clearRootDirectoryHandle();
      const updated = await updateSettings({
        rootFolderName: undefined,
      });
      setSettings(updated);
      setFolderName(null);
      setStatus("保存先フォルダ設定を解除しました。");
    } finally {
      setBusy(false);
    }
  }

  async function reRequestPermission(): Promise<void> {
    try {
      const handle = await loadRootDirectoryHandle({ requestAccess: true });
      if (handle) {
        setFolderName(handle.name);
        setStatus("フォルダへのアクセスが更新されました。");
      } else {
        setStatus("フォルダのアクセス権限を付与してください。");
      }
    } catch (error) {
      console.error(error);
      setStatus("アクセス権限の更新に失敗しました。");
    }
  }

  async function updateTheme(theme: ThemePreference): Promise<void> {
    if (!settings) {
      return;
    }
    const updated = await updateSettings({ theme });
    setSettings(updated);
  }

  async function toggleDomainSubfolders(next: boolean): Promise<void> {
    if (!settings) {
      return;
    }
    const updated = await updateSettings({
      useDomainSubfolders: next,
    });
    setSettings(updated);
    setStatus(
      next
        ? "今後はドメインごとのサブフォルダに保存します。"
        : "今後はフォルダ直下に保存します。",
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-zinc-50 p-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          読み込み中…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1 text-balance">
          <h1 className="text-3xl font-semibold tracking-tight">
            WebClip 設定
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            保存先フォルダと外観をカスタマイズして、選択した文章をすばやくMarkdownへ。
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-medium">保存先フォルダ</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            右クリックで保存するMarkdownのベースフォルダを選択してください。
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">現在のフォルダ</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {folderLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={chooseFolder}
                disabled={busy}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500 hover:shadow-md disabled:opacity-60"
              >
                {busy ? "処理中…" : "フォルダを選択"}
              </button>
              <button
                type="button"
                onClick={reRequestPermission}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-indigo-500 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-200"
              >
                権限を再確認
              </button>
              <button
                type="button"
                onClick={clearFolder}
                className="rounded-full border border-rose-400/70 px-4 py-2 text-sm font-medium text-rose-500 transition hover:border-rose-500 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300"
              >
                設定を解除
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            設定を解除した場合、次回保存時にエラーになりますので、必要に応じて再設定してください。
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-medium">保存スタイル</h2>
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-700"
                checked={settings.useDomainSubfolders}
                onChange={(event) =>
                  toggleDomainSubfolders(event.target.checked)
                }
              />
              <span className="text-sm">
                ドメインごとにサブフォルダを作成してページ単位のMarkdownを保存する
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  例: example.com の記事 →{" "}
                  <code>example-com/記事タイトル.md</code>
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-medium">テーマ</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            オプションページとファイルピッカーに適用されます。
          </p>
          <div className="mt-4 flex gap-3">
            {(["system", "light", "dark"] as ThemePreference[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => updateTheme(value)}
                className={`rounded-xl border px-4 py-2 text-sm capitalize transition ${
                  settings.theme === value
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                    : "border-zinc-200 text-zinc-500 hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {value === "system"
                  ? "システム"
                  : value === "light"
                    ? "ライト"
                    : "ダーク"}
              </button>
            ))}
          </div>
        </section>

        {status && (
          <div className="rounded-xl border border-zinc-200 bg-white/60 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            {status}
          </div>
        )}

        <footer className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          バージョン {chrome.runtime.getManifest().version}
        </footer>
      </div>
    </div>
  );
}

export default App;
