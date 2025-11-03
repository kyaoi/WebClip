import type { ChangeEvent, FormEvent, JSX } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { listFolders } from "../shared/fileSystem";
import { slugify } from "../shared/format";
import {
  clearRootDirectoryHandle,
  loadRootDirectoryHandle,
  saveRootDirectoryHandle,
} from "../shared/handles";
import { getSettings, updateSettings } from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type {
  CategorySetting,
  Settings,
  ThemePreference,
} from "../shared/types";

function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [singleFileInput, setSingleFileInput] = useState("");
  const [aggregateFileNameInput, setAggregateFileNameInput] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, { label: string; folder: string }>
  >({});
  const aggregateInputId = useId();
  const folderDatalistId = useId();
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

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

  const refreshFolderOptions = useCallback(
    async (options: { silent?: boolean } = {}): Promise<void> => {
      const { silent = false } = options;
      if (!settings?.rootFolderName) {
        if (!silent) {
          setStatus("先に保存先フォルダを設定してください。");
        }
        return;
      }
      try {
        setFoldersLoading(true);
        const folders = await listFolders();
        setFolderOptions(folders);
        if (!silent && !folders.length) {
          setStatus(
            "サブフォルダが見つかりませんでした。必要に応じて作成してください。",
          );
        }
      } catch (error) {
        console.error(error);
        if (!silent) {
          setStatus("フォルダ一覧の取得に失敗しました。");
        }
      } finally {
        setFoldersLoading(false);
      }
    },
    [settings?.rootFolderName],
  );

  useEffect(() => {
    if (!settings) {
      setSingleFileInput("");
      setAggregateFileNameInput("");
      setCategoryDrafts({});
      return;
    }
    setSingleFileInput(settings.singleFilePath);
    setAggregateFileNameInput(settings.categoryAggregateFileName);
    setCategoryDrafts(
      Object.fromEntries(
        settings.categories.map((category) => [
          category.id,
          { label: category.label, folder: category.folder },
        ]),
      ),
    );
  }, [settings]);

  useEffect(() => {
    if (settings?.rootFolderName) {
      void refreshFolderOptions({ silent: true });
    } else {
      setFolderOptions([]);
    }
  }, [refreshFolderOptions, settings?.rootFolderName]);

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

  async function saveSingleFilePath(path: string): Promise<void> {
    if (!settings) {
      return;
    }
    const trimmed = path.trim();
    if (!trimmed) {
      setStatus("単一ファイル名を入力してください。");
      return;
    }
    const normalized = trimmed.toLowerCase().endsWith(".md")
      ? trimmed
      : `${trimmed}.md`;
    const updated = await updateSettings({ singleFilePath: normalized });
    setSettings(updated);
    setStatus(`今後は ${updated.singleFilePath} に追記します。`);
  }

  async function handleSingleFileSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await saveSingleFilePath(singleFileInput);
  }

  async function handleAggregateFileSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!settings) {
      return;
    }
    const trimmed = aggregateFileNameInput.trim();
    if (!trimmed) {
      setStatus("集約ファイル名を入力してください。");
      return;
    }
    const updated = await updateSettings({
      categoryAggregateFileName: trimmed.endsWith(".md")
        ? trimmed
        : `${trimmed}.md`,
    });
    setSettings(updated);
    setStatus(
      `カテゴリ集約ファイル名を ${updated.categoryAggregateFileName} に更新しました。`,
    );
  }

  async function addCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!settings) {
      return;
    }
    const label = newCategoryLabel.trim();
    if (!label) {
      setStatus("カテゴリ名を入力してください。");
      return;
    }
    const nextCategory: CategorySetting = {
      id: crypto.randomUUID(),
      label,
      folder: slugify(label),
      aggregate: false,
    };
    const updated = await updateSettings({
      categories: [...settings.categories, nextCategory],
    });
    setSettings(updated);
    setNewCategoryLabel("");
    setStatus(`カテゴリ「${label}」を追加しました。`);
  }

  async function handleCategoryBlur(
    id: string,
    draftOverride?: { label: string; folder: string },
  ): Promise<void> {
    if (!settings) {
      return;
    }
    const draft = draftOverride ?? categoryDrafts[id];
    const current = settings.categories.find((item) => item.id === id);
    if (!draft || !current) {
      return;
    }
    const label = draft.label.trim();
    if (!label) {
      setStatus("カテゴリ名を入力してください。");
      return;
    }
    const folder = draft.folder.trim() || slugify(label);
    const nextCategories = settings.categories.map((item) =>
      item.id === id ? { ...item, label, folder } : item,
    );
    const updated = await updateSettings({ categories: nextCategories });
    setSettings(updated);
    setStatus(`カテゴリ「${label}」を更新しました。`);
  }

  async function toggleCategoryAggregate(
    id: string,
    next: boolean,
  ): Promise<void> {
    if (!settings) {
      return;
    }
    const current = settings.categories.find((item) => item.id === id);
    if (!current) {
      return;
    }
    const nextCategories = settings.categories.map((item) =>
      item.id === id ? { ...item, aggregate: next } : item,
    );
    const updated = await updateSettings({ categories: nextCategories });
    setSettings(updated);
    setStatus(
      next
        ? `カテゴリ「${current.label}」は集約ファイルに保存します。`
        : `カテゴリ「${current.label}」はページごとのファイルに保存します。`,
    );
  }

  async function removeCategory(id: string): Promise<void> {
    if (!settings) {
      return;
    }
    const target = settings.categories.find((item) => item.id === id);
    const nextCategories = settings.categories.filter((item) => item.id !== id);
    const updated = await updateSettings({ categories: nextCategories });
    setSettings(updated);
    setStatus(
      target
        ? `カテゴリ「${target.label}」を削除しました。`
        : "カテゴリを削除しました。",
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
          <div className="mt-4 flex flex-col gap-6">
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

            <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 text-sm shadow-sm dark:border-indigo-500/50 dark:bg-indigo-500/10">
              <h3 className="text-base font-semibold text-indigo-700 dark:text-indigo-300">
                単一ファイルスタイル
              </h3>
              <p className="mt-1 text-xs text-indigo-600/80 dark:text-indigo-200/80">
                すべてのクリップを1つのMarkdownに時系列で追記します。メモの整理前に一括で集めたい場合に便利です。
              </p>
              <form
                onSubmit={handleSingleFileSubmit}
                className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <input
                  value={singleFileInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSingleFileInput(event.target.value)
                  }
                  placeholder="inbox.md"
                  className="w-full flex-1 rounded-xl border border-indigo-200 bg-white/80 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-indigo-500/60 dark:bg-zinc-900/90 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  保存
                </button>
              </form>
              <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-200/70">
                例: <code>inbox.md</code> や <code>notes/inbox.md</code>
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                カテゴリ分類スタイル
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                保存時にカテゴリを選び、自動で{" "}
                <code>/カテゴリ名/ページタイトル.md</code>{" "}
                へ保存します。カテゴリごとに集約ファイルへ切り替えることもできます。
              </p>

              <form
                onSubmit={addCategory}
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <input
                  value={newCategoryLabel}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setNewCategoryLabel(event.target.value)
                  }
                  placeholder="カテゴリ名（例: 技術）"
                  className="w-full flex-1 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  追加
                </button>
              </form>

              <form
                onSubmit={handleAggregateFileSubmit}
                className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <label
                  htmlFor={aggregateInputId}
                  className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  集約ファイル名
                </label>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    id={aggregateInputId}
                    value={aggregateFileNameInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setAggregateFileNameInput(event.target.value)
                    }
                    placeholder="inbox.md"
                    className="w-full rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:border-indigo-500 hover:text-indigo-500 dark:border-indigo-500/60 dark:text-indigo-300"
                  >
                    更新
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void refreshFolderOptions()}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                  disabled={foldersLoading}
                >
                  {foldersLoading
                    ? "フォルダを読み込み中…"
                    : "フォルダ一覧を更新"}
                </button>
                {settings?.rootFolderName ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    保存先フォルダ配下のサブフォルダ候補を利用できます。
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    先に保存先フォルダを設定してください。
                  </p>
                )}
              </div>

              <datalist id={folderDatalistId}>
                {folderOptions.map((folder) => (
                  <option key={folder} value={folder} />
                ))}
              </datalist>

              {settings.categories.length ? (
                <ul className="mt-4 space-y-3">
                  {settings.categories.map((category) => {
                    const draft = categoryDrafts[category.id] ?? {
                      label: category.label,
                      folder: category.folder,
                    };
                    return (
                      <li
                        key={category.id}
                        className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/70"
                      >
                        <div className="flex flex-col gap-3">
                          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            カテゴリ名
                            <input
                              value={draft.label}
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>,
                              ) =>
                                setCategoryDrafts((prev) => {
                                  const prevEntry = prev[category.id] ?? {
                                    label: category.label,
                                    folder: category.folder,
                                  };
                                  const nextLabel = event.target.value;
                                  const shouldSyncFolder =
                                    prevEntry.folder ===
                                      slugify(prevEntry.label) ||
                                    prevEntry.folder === category.folder;
                                  return {
                                    ...prev,
                                    [category.id]: {
                                      label: nextLabel,
                                      folder: shouldSyncFolder
                                        ? slugify(nextLabel)
                                        : prevEntry.folder,
                                    },
                                  };
                                })
                              }
                              onBlur={() =>
                                void handleCategoryBlur(category.id, draft)
                              }
                              className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            サブフォルダ名
                            <input
                              value={draft.folder}
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>,
                              ) =>
                                setCategoryDrafts((prev) => {
                                  const prevEntry = prev[category.id] ?? draft;
                                  return {
                                    ...prev,
                                    [category.id]: {
                                      label: prevEntry.label,
                                      folder: event.target.value,
                                    },
                                  };
                                })
                              }
                              onBlur={() =>
                                void handleCategoryBlur(category.id, draft)
                              }
                              list={folderDatalistId}
                              className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                            />
                            {folderOptions.length ? (
                              <select
                                defaultValue=""
                                onChange={(event) => {
                                  const selected = event.target.value;
                                  if (!selected) {
                                    return;
                                  }
                                  const nextDraft = {
                                    label: draft.label,
                                    folder: selected,
                                  };
                                  setCategoryDrafts((prev) => ({
                                    ...prev,
                                    [category.id]: nextDraft,
                                  }));
                                  void handleCategoryBlur(
                                    category.id,
                                    nextDraft,
                                  );
                                  event.target.value = "";
                                }}
                                className="mt-2 rounded-lg border border-zinc-200 bg-white/60 px-2 py-1 text-xs text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300"
                              >
                                <option value="">候補から選択…</option>
                                {folderOptions.map((folder) => (
                                  <option key={folder} value={folder}>
                                    {folder}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={category.aggregate}
                                onChange={(event) =>
                                  void toggleCategoryAggregate(
                                    category.id,
                                    event.target.checked,
                                  )
                                }
                                className="size-4 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-600"
                              />
                              集約ファイル（{settings.categoryAggregateFileName}
                              ）に保存
                            </label>
                            <button
                              type="button"
                              onClick={() => void removeCategory(category.id)}
                              className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-400 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300"
                            >
                              削除
                            </button>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            保存パス例: {draft.folder || slugify(draft.label)}/
                            {category.aggregate
                              ? settings.categoryAggregateFileName
                              : "<ページタイトル>.md"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  まだカテゴリがありません。上のフォームから追加してください。
                </p>
              )}
            </div>
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
