import type { JSX } from "react";
import { useEffect, useState } from "react";
import { loadRootDirectoryHandle } from "../shared/handles";
import {
  getActiveTemplate,
  getSettings,
  updateSettings,
} from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type { Settings, ThemePreference } from "../shared/types";

function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folderName, setFolderName] = useState<string>("未設定");

  useEffect(() => {
    void (async () => {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      if (loadedSettings) {
        applyTheme(loadedSettings.theme);
      }
      const handle = await loadRootDirectoryHandle({ requestAccess: false });
      if (handle) {
        setFolderName(handle.name);
      } else if (loadedSettings.rootFolderName) {
        setFolderName(`${loadedSettings.rootFolderName}（要権限）`);
      }
    })();
  }, []);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);

  function openOptions(): void {
    chrome.runtime.openOptionsPage();
  }

  async function updateTheme(theme: ThemePreference): Promise<void> {
    if (!settings) {
      return;
    }
    const updated = await updateSettings({ theme });
    setSettings(updated);
  }

  if (!settings) {
    return (
      <div className="min-w-[420px] max-w-[640px] bg-zinc-50 p-5 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          読み込み中…
        </p>
      </div>
    );
  }

  const template = getActiveTemplate(settings);

  return (
    <div className="min-w-[420px] max-w-[640px] bg-zinc-50 p-5 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex flex-col gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h1 className="text-xl font-semibold leading-tight">WebClip</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            選択したテキストをMarkdownへ保存するChrome拡張です。
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            保存先フォルダ
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {folderName}
          </p>
          <button
            type="button"
            onClick={openOptions}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            設定を開く
          </button>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            保存スタイル
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              使用テンプレート:{" "}
              <span className="font-medium">{template.name}</span>
            </li>
            <li>
              単一ファイル: <code>{template.singleFilePath}</code>
            </li>
            <li>
              ドメイン分類: {template.useDomainSubfolders ? "有効" : "無効"}
            </li>
          </ul>
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
            <p className="font-semibold text-zinc-600 dark:text-zinc-300">
              カテゴリ一覧
            </p>
            {template.categories.length ? (
              <ul className="mt-1 space-y-1">
                {template.categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>{category.label}</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {category.aggregate
                        ? `${category.folder}/${template.categoryAggregateFileName}`
                        : `${category.folder}/<タイトル>.md`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">カテゴリは未設定です。</p>
            )}
            <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              詳細は「設定を開く」から変更できます。
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            使い方
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>保存したい文章を選択します。</li>
            <li>
              右クリックし「Save to Markdown」または「Save to existing
              file…」を選びます。
            </li>
            <li>完了通知でファイルパスを確認します。</li>
          </ol>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            既存ファイルへの保存は、ピッカーで既存のMarkdownを選ぶか新規作成を行ってください。
          </p>
        </section>

        {settings?.mruFiles.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              最近保存したファイル
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              {settings.mruFiles.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          </section>
        ) : null}

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

        <footer className="rounded-2xl border border-indigo-200/60 bg-indigo-50/80 p-4 text-xs text-indigo-600 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300">
          コンテキストメニューが表示されない場合は、拡張機能を再読み込みしてください。
        </footer>
      </div>
    </div>
  );
}

export default App;
