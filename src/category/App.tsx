import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveTemplate } from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type {
  CategorySetting,
  SelectionContext,
  Settings,
} from "../shared/types";

interface CategoryInitResponse {
  ok: boolean;
  context?: SelectionContext;
  settings?: Settings;
  error?: string;
}

type CategoryClipMode = "aggregate" | "page";

interface CategorySaveResponse {
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        type: "webclip:category:init",
        requestId: id,
      })) as CategoryInitResponse;
      if (!initResponse.ok || !initResponse.context || !initResponse.settings) {
        setError(initResponse.error ?? "初期データの取得に失敗しました。");
        setLoading(false);
        return;
      }
      setContext(initResponse.context);
      setSettings(initResponse.settings);
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

  const activeTemplate = useMemo(() => {
    if (!settings) {
      return null;
    }
    return getActiveTemplate(settings);
  }, [settings]);

  const categories = useMemo<CategorySetting[]>(() => {
    if (!activeTemplate) {
      return [];
    }
    return [...activeTemplate.categories].sort((a, b) =>
      a.label.localeCompare(b.label, "ja"),
    );
  }, [activeTemplate]);

  const selectionSnippet = useMemo(() => {
    const text = context?.selection.trim().replace(/\s+/g, " ") ?? "";
    return text.slice(0, 140);
  }, [context]);

  async function handleSelectCategory(
    categoryId: string,
    mode: CategoryClipMode,
  ): Promise<void> {
    if (!requestId) {
      return;
    }
    try {
      setSaving(true);
      const response = (await chrome.runtime.sendMessage({
        type: "webclip:category:save",
        requestId,
        categoryId,
        mode,
      })) as CategorySaveResponse;
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

  async function handleCancel(): Promise<void> {
    if (!requestId) {
      window.close();
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: "webclip:category:cancel",
        requestId,
      });
    } finally {
      window.close();
    }
  }

  function openOptions(): void {
    chrome.runtime.openOptionsPage();
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
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

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

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            カテゴリを選択
          </h2>
          {categories.length ? (
            <ul className="mt-3 space-y-3">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="rounded-xl border border-zinc-200 bg-white/70 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/70"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {category.label}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        サブフォルダ: {category.folder || "(ルート)"}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSelectCategory(category.id, "page")
                        }
                        disabled={saving}
                        className="rounded-lg border border-indigo-200 bg-white/80 px-3 py-2 text-sm transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-500/50 dark:bg-zinc-900/80 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/20"
                      >
                        ページごとに保存
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {category.folder || "(ルート)"}/
                          {"<ページタイトル>.md"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleSelectCategory(category.id, "aggregate")
                        }
                        disabled={saving}
                        className="rounded-lg border border-indigo-500 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-600 transition hover:border-indigo-500 hover:bg-indigo-100 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-200"
                      >
                        カテゴリ集約ファイルに保存
                        <span className="block text-xs text-indigo-500/80 dark:text-indigo-200/80">
                          {category.folder || "(ルート)"}/
                          {activeTemplate?.categoryAggregateFileName ?? ""}
                        </span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              カテゴリが設定されていません。オプションページでカテゴリを追加してください。
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={openOptions}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
            >
              設定を開く
            </button>
          </div>
        </section>

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
