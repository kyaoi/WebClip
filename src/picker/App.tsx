import type { FormEvent, JSX } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { listMarkdownFiles } from "../shared/fileSystem";
import { applyTheme } from "../shared/theme";
import type { SelectionContext, Settings } from "../shared/types";

interface PickerInitResponse {
  ok: boolean;
  context?: SelectionContext;
  settings?: Settings;
  error?: string;
}

interface PickerSaveResponse {
  ok: boolean;
  result?: {
    status: string;
    message: string;
  };
  error?: string;
}

function App(): JSX.Element {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [context, setContext] = useState<SelectionContext | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [newFile, setNewFile] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchInputId = useId();

  const initialize = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    setError(null);
    const params = new URLSearchParams(window.location.search);
    const id = params.get("requestId");
    if (!id) {
      setError(
        "リクエストIDが見つかりません。ウィンドウを閉じてやり直してください。",
      );
      setLoading(false);
      return;
    }
    setRequestId(id);
    try {
      const initResponse = (await chrome.runtime.sendMessage({
        type: "webclip:picker:init",
        requestId: id,
      })) as PickerInitResponse;
      if (!initResponse.ok || !initResponse.context || !initResponse.settings) {
        setError(initResponse.error ?? "初期データの取得に失敗しました。");
        setLoading(false);
        return;
      }
      setContext(initResponse.context);
      setSettings(initResponse.settings);
      const fileList = await listMarkdownFiles();
      setFiles(fileList);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("初期化中にエラーが発生しました。");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return files;
    }
    return files.filter((item) => item.toLowerCase().includes(keyword));
  }, [files, search]);

  async function handleSave(
    path: string,
    createIfMissing: boolean,
  ): Promise<void> {
    if (!requestId) {
      return;
    }
    try {
      setSaving(true);
      const response = (await chrome.runtime.sendMessage({
        type: "webclip:picker:save",
        requestId,
        path,
        createIfMissing,
      })) as PickerSaveResponse;
      if (!response.ok || !response.result) {
        setStatus(response.error ?? "保存に失敗しました。");
        setSaving(false);
        return;
      }
      setStatus(response.result.message);
      setTimeout(() => window.close(), 900);
    } catch (err) {
      console.error(err);
      setStatus("保存中にエラーが発生しました。");
      setSaving(false);
    }
  }

  function normalizePath(input: string): string | null {
    const trimmed = input.trim().replace(/^\/+/, "");
    if (!trimmed) {
      return null;
    }
    const parts = trimmed
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const popped = parts.pop();
    let fileName = popped ?? "note.md";
    if (!fileName.toLowerCase().endsWith(".md")) {
      fileName = `${fileName}.md`;
    }
    return [...parts, fileName].join("/");
  }

  async function handleCreateNew(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const normalized = normalizePath(newFile);
    if (!normalized) {
      setStatus("有効なファイル名を入力してください。");
      return;
    }
    await handleSave(normalized, true);
  }

  async function handleCancel(): Promise<void> {
    if (!requestId) {
      window.close();
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: "webclip:picker:cancel",
        requestId,
      });
    } finally {
      window.close();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          読み込み中…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="rounded-xl border border-rose-400/60 bg-white/80 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/50 dark:bg-zinc-900/70 dark:text-rose-300">
          {error}
        </div>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  const selectionSnippet = context?.selection
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);

  return (
    <div className="min-h-screen bg-zinc-50 px-5 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex flex-col gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
            保存するテキスト
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {selectionSnippet}
          </p>
          {context && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {new URL(context.baseUrl).hostname} — {context.title}
            </p>
          )}
        </header>

        {settings?.mruFiles.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              最近使ったファイル
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {settings.mruFiles.map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => handleSave(path, false)}
                  disabled={saving}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-indigo-500 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {path}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor={searchInputId}
                className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                ファイルを検索
              </label>
              <input
                id={searchInputId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="タイトルまたはパスで絞り込み..."
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                保存先フォルダ配下のすべてのMarkdownファイル（サブフォルダ含む）が対象です。
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 shadow-inner dark:border-zinc-800/80">
              {filteredFiles.length ? (
                <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                  {filteredFiles.map((path) => (
                    <li key={path}>
                      <button
                        type="button"
                        onClick={() => handleSave(path, false)}
                        disabled={saving}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-indigo-50 dark:hover:bg-indigo-500/20"
                      >
                        <span>{path}</span>
                        <span className="text-xs text-zinc-400">
                          既存ファイル
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  一致するMarkdownファイルが見つかりませんでした。
                </div>
              )}
            </div>
          </div>
        </section>

        <form
          onSubmit={handleCreateNew}
          className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            新規ファイルに保存
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            サブフォルダを含むパスを指定できます（例: ideas/vision.md）。
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={newFile}
              onChange={(event) => setNewFile(event.target.value)}
              placeholder="notes/today.md"
              className="flex-1 rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              新規作成
            </button>
          </div>
        </form>

        {status && (
          <div className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            {status}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void initialize()}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            再読み込み
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-600 transition hover:border-rose-400 hover:text-rose-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
