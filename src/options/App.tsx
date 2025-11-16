import {
  AlertCircle,
  Download,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildDirectoryTree,
  createDirectory,
  type DirectoryTreeResult,
} from "../shared/fileSystem";
import {
  clearRootDirectoryHandle,
  loadRootDirectoryHandle,
  saveRootDirectoryHandle,
} from "../shared/handles";
import { getSettings, updateSettings } from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type {
  Settings,
  TemplateFrontMatterField,
  TemplateSetting,
  ThemePreference,
} from "../shared/types";
import { DEFAULT_ENTRY_TEMPLATE } from "../shared/types";
import SidebarTreePanel from "./components/SidebarTreePanel";

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [singleFileInput, setSingleFileInput] = useState("");
  const [frontMatterEnabled, setFrontMatterEnabled] = useState(false);
  const [frontMatterDrafts, setFrontMatterDrafts] = useState<
    TemplateFrontMatterField[]
  >([]);
  const [entryTemplateInput, setEntryTemplateInput] = useState("");
  const [directoryTree, setDirectoryTree] =
    useState<DirectoryTreeResult | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const previousTemplateIdRef = useRef<string | null>(null);
  const treeTemplateIdRef = useRef<string | null>(null);

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

  // 選択されたパスからルートカテゴリ名を取得
  const selectedRootCategory = useMemo(() => {
    if (!selectedTreePath) {
      return null;
    }
    const pathParts = selectedTreePath.split("/").filter(Boolean);
    if (pathParts.length === 0) {
      return null;
    }
    // ルートカテゴリ（第1階層）を取得
    return pathParts[0];
  }, [selectedTreePath]);

  // 選択されたカテゴリに対応するテンプレートを取得
  const selectedTemplate = useMemo(() => {
    if (!settings?.templates.length) {
      return null;
    }

    // カテゴリが選択されている場合、そのカテゴリ名と一致するテンプレートを探す
    if (selectedRootCategory) {
      const matchingTemplate = settings.templates.find(
        (template) => template.name === selectedRootCategory,
      );
      if (matchingTemplate) {
        return matchingTemplate;
      }
    }

    // 見つからない場合は最初のテンプレートを返す
    return settings.templates[0];
  }, [settings?.templates, selectedRootCategory]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSingleFileInput("");
      setFrontMatterEnabled(false);
      setFrontMatterDrafts([]);
      setEntryTemplateInput("");
      previousTemplateIdRef.current = null;
      treeTemplateIdRef.current = null;
      return;
    }

    // テンプレートIDが変更された場合のみ、状態を完全にリセット
    if (previousTemplateIdRef.current !== selectedTemplate.id) {
      previousTemplateIdRef.current = selectedTemplate.id;
      setSingleFileInput(selectedTemplate.singleFilePath);
      setFrontMatterEnabled(selectedTemplate.frontMatter.enabled);
      setFrontMatterDrafts(
        selectedTemplate.frontMatter.fields.map((field) => ({ ...field })),
      );
      setEntryTemplateInput(selectedTemplate.entryTemplate);
    }
  }, [selectedTemplate?.id, selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    if (treeTemplateIdRef.current !== selectedTemplate.id) {
      treeTemplateIdRef.current = selectedTemplate.id;
    }
  }, [selectedTemplate?.id, selectedTemplate]);

  const folderLabel = useMemo(() => {
    if (folderName) {
      return folderName;
    }
    if (settings?.rootFolderName) {
      return `${settings.rootFolderName}（権限が必要です）`;
    }
    return "未設定";
  }, [folderName, settings]);

  const handleTreeNodeToggle = useCallback((nodeId: string): void => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleTreePathSelect = useCallback((path: string): void => {
    setSelectedTreePath(path);
  }, []);

  const handleTreeSearchChange = useCallback((value: string): void => {
    setTreeSearch(value);
  }, []);

  const refreshDirectoryTree = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<void> => {
      if (!settings?.rootFolderName) {
        setDirectoryTree(null);
        setTreeError(null);
        return;
      }
      const { interactive = false } = options;
      try {
        setTreeLoading(true);
        setTreeError(null);
        const result = await buildDirectoryTree({ requestAccess: interactive });
        setDirectoryTree(result);
        // ツリー読み込み時は閉じた状態で開始（自動展開しない）
      } catch (error) {
        console.error(error);
        setTreeError("ディレクトリツリーの取得に失敗しました。");
      } finally {
        setTreeLoading(false);
      }
    },
    [settings?.rootFolderName],
  );

  useEffect(() => {
    if (settings?.rootFolderName) {
      void refreshDirectoryTree();
    } else {
      setDirectoryTree(null);
      setTreeError(null);
    }
  }, [refreshDirectoryTree, settings?.rootFolderName]);

  const handleTreeReload = useCallback(() => {
    void refreshDirectoryTree({ interactive: true });
  }, [refreshDirectoryTree]);

  const applyTemplateUpdate = useCallback(
    async (
      templateId: string,
      updater: (template: TemplateSetting) => TemplateSetting,
    ): Promise<void> => {
      if (!settings) {
        return;
      }
      if (!settings.templates.some((template) => template.id === templateId)) {
        return;
      }
      const nextTemplates = settings.templates.map((template) =>
        template.id === templateId ? updater(template) : template,
      );
      const updated = await updateSettings({ templates: nextTemplates });
      setSettings(updated);
    },
    [settings],
  );

  const handleCreateDirectory = useCallback(
    async (parentPath: string): Promise<void> => {
      const name = prompt("新しいフォルダ名を入力してください:");
      if (!name || !name.trim()) {
        return;
      }
      const trimmed = name.trim();
      const pathSegments = parentPath
        ? [...parentPath.split("/"), trimmed]
        : [trimmed];
      const result = await createDirectory(pathSegments);
      if (result.success) {
        setStatus(`フォルダ「${trimmed}」を作成しました。`);
        await refreshDirectoryTree({ interactive: false });

        // ルートレベルのディレクトリ作成時は自動的にテンプレートを作成
        if (!parentPath && settings) {
          // 同名のテンプレートが既に存在するか確認
          const existingTemplate = settings.templates.find(
            (t) => t.name === trimmed,
          );

          if (!existingTemplate) {
            // 新しいテンプレートを作成
            const newTemplate: TemplateSetting = {
              id: crypto.randomUUID(),
              name: trimmed,
              useDomainSubfolders: true,
              singleFilePath: "inbox.md",
              categories: [],
              categoryAggregateFileName: "inbox.md",
              directoryCategorySettings: {
                [trimmed]: {
                  aggregate: false,
                  subfolders: [],
                },
              },
              frontMatter: {
                enabled: false,
                fields: [],
              },
              entryTemplate: DEFAULT_ENTRY_TEMPLATE,
              directoryTemplates: [],
            };

            const updated = await updateSettings({
              templates: [...settings.templates, newTemplate],
            });
            setSettings(updated);
          }

          // 新しく作成したディレクトリを選択
          setSelectedTreePath(trimmed);
          setStatus(
            `フォルダ「${trimmed}」を作成し、テンプレートを追加しました。`,
          );
        }
      } else {
        setStatus(result.error ?? "フォルダの作成に失敗しました。");
      }
    },
    [refreshDirectoryTree, settings],
  );

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
    if (!selectedTemplate) {
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      useDomainSubfolders: next,
    }));
    setStatus(
      next
        ? "今後はドメインごとのサブフォルダに保存します。"
        : "今後はフォルダ直下に保存します。",
    );
  }

  async function saveSingleFilePath(path: string): Promise<void> {
    if (!selectedTemplate) {
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
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      singleFilePath: normalized,
    }));
    setStatus(`今後は ${normalized} に追記します。`);
  }

  async function handleSingleFileSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await saveSingleFilePath(singleFileInput);
  }

  async function toggleFrontMatterEnabled(next: boolean): Promise<void> {
    if (!selectedTemplate) {
      setFrontMatterEnabled(next);
      return;
    }
    setFrontMatterEnabled(next);
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      frontMatter: {
        ...template.frontMatter,
        enabled: next,
      },
    }));
    setStatus(
      next
        ? "フロントマターを有効にしました。"
        : "フロントマターを無効にしました。",
    );
  }

  function addFrontMatterField(): void {
    if (!selectedTemplate) {
      return;
    }
    const newField: TemplateFrontMatterField = {
      id: crypto.randomUUID(),
      key: "",
      value: "",
      updateOnClip: false,
    };
    setFrontMatterDrafts((prev) => [...prev, newField]);
  }

  async function handleFrontMatterFieldBlur(
    fieldId: string,
    draft: TemplateFrontMatterField,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const key = draft.key.trim();
    if (!key) {
      setStatus("フロントマターのキーを入力してください。");
      return;
    }
    const value = draft.value;
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      frontMatter: {
        ...template.frontMatter,
        fields: template.frontMatter.fields.some(
          (field) => field.id === fieldId,
        )
          ? template.frontMatter.fields.map((field) =>
              field.id === fieldId
                ? { ...field, key, value, updateOnClip: draft.updateOnClip }
                : field,
            )
          : [
              ...template.frontMatter.fields,
              {
                id: fieldId,
                key,
                value,
                updateOnClip: draft.updateOnClip,
              },
            ],
      },
    }));
    setFrontMatterDrafts((prev) =>
      prev.map((field) =>
        field.id === fieldId
          ? { ...field, key, value, updateOnClip: draft.updateOnClip }
          : field,
      ),
    );
    setStatus(`フロントマター「${key}」を更新しました。`);
  }

  async function removeFrontMatterField(fieldId: string): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const target = frontMatterDrafts.find((field) => field.id === fieldId);
    setFrontMatterDrafts((prev) =>
      prev.filter((field) => field.id !== fieldId),
    );
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      frontMatter: {
        ...template.frontMatter,
        fields: template.frontMatter.fields.filter(
          (field) => field.id !== fieldId,
        ),
      },
    }));
    setStatus(
      target?.key
        ? `フロントマター「${target.key}」を削除しました。`
        : "フロントマターを削除しました。",
    );
  }

  async function toggleFrontMatterFieldUpdate(
    fieldId: string,
    next: boolean,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    setFrontMatterDrafts((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, updateOnClip: next } : field,
      ),
    );
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      frontMatter: {
        ...template.frontMatter,
        fields: template.frontMatter.fields.map((field) =>
          field.id === fieldId ? { ...field, updateOnClip: next } : field,
        ),
      },
    }));
  }

  async function saveEntryTemplate(): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    if (!entryTemplateInput.trim()) {
      setStatus("保存フォーマットを入力してください。");
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      entryTemplate: entryTemplateInput,
    }));
    setStatus("保存フォーマットを更新しました。");
  }

  async function resetEntryTemplate(): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    setEntryTemplateInput(DEFAULT_ENTRY_TEMPLATE);
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      entryTemplate: DEFAULT_ENTRY_TEMPLATE,
    }));
    setStatus("保存フォーマットを既定に戻しました。");
  }

  async function exportSettingsToFile(): Promise<void> {
    try {
      const current = settings ?? (await getSettings());
      const payload = JSON.stringify(current, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `webclip-settings-${timestamp}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("設定をエクスポートしました。");
    } catch (error) {
      console.error(error);
      setStatus("設定のエクスポートに失敗しました。");
    }
  }

  async function handleImportSettings(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const [file] = event.target.files ?? [];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<Settings>;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid settings file");
      }
      const updated = await updateSettings(parsed);
      setSettings(updated);
      setFolderName(updated.rootFolderName ?? null);
      setStatus("設定をインポートしました。");
    } catch (error) {
      console.error(error);
      setStatus("設定ファイルの読み込みに失敗しました。");
    }
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-6 py-8 text-zinc-900 dark:bg-gradient-to-br dark:from-zinc-950 dark:via-indigo-950 dark:to-purple-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full flex-col gap-6">
        <header className="flex flex-col gap-3 text-balance">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/50">
              <Sparkles className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                WebClip 設定
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                保存先フォルダとテンプレートをカスタマイズして、選択した文章をすばやくMarkdownへ。
              </p>
            </div>
          </div>
        </header>

        <section className="group rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg shadow-zinc-200/50 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-zinc-300/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:hover:border-zinc-700">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/30 dark:text-indigo-400">
              <FolderOpen className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold dark:text-zinc-50">
                保存先フォルダ
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                右クリックで保存するMarkdownのベースフォルダを選択してください。
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-xl bg-zinc-50/80 px-4 py-3 dark:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                現在のフォルダ
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {folderLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={chooseFolder}
                disabled={busy}
                className="group/btn inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/50 disabled:opacity-60 disabled:hover:scale-100 dark:shadow-indigo-500/20 dark:hover:shadow-indigo-500/40"
              >
                <FolderOpen className="size-4 transition-transform group-hover/btn:scale-110" />
                {busy ? "処理中…" : "フォルダを選択"}
              </button>
              <button
                type="button"
                onClick={reRequestPermission}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:scale-105 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <RotateCcw className="size-4" />
                権限を再確認
              </button>
              <button
                type="button"
                onClick={clearFolder}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition-all hover:scale-105 hover:border-rose-400 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-800 dark:text-rose-400 dark:hover:border-rose-700 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="size-4" />
                設定を解除
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
            <p>
              設定を解除した場合、次回保存時にエラーになりますので、必要に応じて再設定してください。
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* サイドバー: ツリーパネル */}
          <div className="flex flex-col">
            <SidebarTreePanel
              folderLabel={folderLabel}
              hasRootFolder={Boolean(settings.rootFolderName)}
              rootName={
                directoryTree?.rootName ?? settings.rootFolderName ?? null
              }
              nodes={directoryTree?.nodes ?? []}
              searchQuery={treeSearch}
              onSearchChange={handleTreeSearchChange}
              expandedNodeIds={expandedNodeIds}
              onToggleNode={handleTreeNodeToggle}
              selectedPath={selectedTreePath}
              onSelectPath={handleTreePathSelect}
              onCreateDirectory={handleCreateDirectory}
              onChooseFolder={chooseFolder}
              onReloadTree={handleTreeReload}
              onReRequestPermission={reRequestPermission}
              isLoading={treeLoading}
              requiresPermission={Boolean(directoryTree?.requiresPermission)}
              treeError={treeError}
              truncated={Boolean(directoryTree?.truncated)}
              totalCount={directoryTree?.totalCount ?? 0}
            />
          </div>

          {/* メインビュー: テンプレート設定 */}
          <section className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg shadow-zinc-200/50 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-start gap-3 border-b-2 border-zinc-100 pb-5 dark:border-zinc-800">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-500/30 dark:text-purple-400">
                <FolderTree className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold dark:text-zinc-50">
                  テンプレート設定
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  選択したカテゴリのテンプレート設定を編集できます
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              {/* エクスポート・インポートボタン */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {selectedRootCategory && (
                  <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-100 px-4 py-2 shadow-sm dark:bg-gradient-to-r dark:from-emerald-950/50 dark:to-teal-950/50 dark:shadow-none">
                    <FolderOpen className="size-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      {selectedRootCategory}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      のテンプレート設定
                    </span>
                  </div>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void exportSettingsToFile()}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:scale-105 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    <Download className="size-4" />
                    エクスポート
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:scale-105 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    <Upload className="size-4" />
                    インポート
                  </button>
                </div>
              </div>

              {!selectedRootCategory ? (
                <div className="mb-5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/50">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                    <FolderPlus className="size-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="mt-3 font-semibold text-amber-900 dark:text-amber-200">
                    カテゴリを選択してください
                  </h3>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    左のツリーからカテゴリを選択すると、そのカテゴリ専用のテンプレート設定が表示されます
                  </p>
                </div>
              ) : selectedTemplate ? (
                <div className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-6">
                      <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-600 dark:accent-indigo-500"
                            checked={selectedTemplate.useDomainSubfolders}
                            onChange={(event) =>
                              toggleDomainSubfolders(event.target.checked)
                            }
                          />
                          <span className="dark:text-zinc-200">
                            ドメインごとにサブフォルダを作成してページ単位のMarkdownを保存する
                            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                              例: example.com の記事 →{" "}
                              <code className="dark:text-zinc-300">
                                example-com/記事タイトル.md
                              </code>
                            </span>
                          </span>
                        </label>
                      </div>

                      <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 text-sm shadow-sm dark:border-indigo-800 dark:bg-indigo-950/30">
                        <h3 className="text-base font-semibold text-indigo-700 dark:text-indigo-300">
                          単一ファイルスタイル
                        </h3>
                        <p className="mt-1 text-xs text-indigo-600/80 dark:text-indigo-400">
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
                            className="w-full flex-1 rounded-xl border border-indigo-200 bg-white/80 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-600"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/50 dark:shadow-indigo-500/20 dark:hover:shadow-indigo-500/40"
                          >
                            <Save className="size-4" />
                            保存
                          </button>
                        </form>
                        <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-400">
                          例:{" "}
                          <code className="dark:text-indigo-300">inbox.md</code>{" "}
                          や{" "}
                          <code className="dark:text-indigo-300">
                            notes/inbox.md
                          </code>
                        </p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                フロントマター
                              </h3>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                新規作成時にYAMLフロントマターを挿入し、必要に応じてクリップ時に値を更新します。
                              </p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                className="size-4 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-700"
                                checked={frontMatterEnabled}
                                onChange={(event) =>
                                  void toggleFrontMatterEnabled(
                                    event.target.checked,
                                  )
                                }
                              />
                              有効にする
                            </label>
                          </div>
                          <div className="mt-4 flex flex-col gap-3">
                            <button
                              type="button"
                              onClick={addFrontMatterField}
                              className="self-start inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-all hover:scale-105 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
                            >
                              <Plus className="size-3" />
                              項目を追加
                            </button>
                            {frontMatterDrafts.length ? (
                              <div className="flex flex-col gap-3">
                                {frontMatterDrafts.map((field) => {
                                  const draft = field;
                                  return (
                                    <div
                                      key={field.id}
                                      className="rounded-lg border border-zinc-200 bg-white/70 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/80"
                                    >
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                        <div className="flex-1">
                                          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            キー
                                            <input
                                              value={draft.key}
                                              onChange={(
                                                event: ChangeEvent<HTMLInputElement>,
                                              ) =>
                                                setFrontMatterDrafts((prev) =>
                                                  prev.map((item) =>
                                                    item.id === field.id
                                                      ? {
                                                          ...item,
                                                          key: event.target
                                                            .value,
                                                        }
                                                      : item,
                                                  ),
                                                )
                                              }
                                              onBlur={() =>
                                                void handleFrontMatterFieldBlur(
                                                  field.id,
                                                  {
                                                    ...draft,
                                                    key: draft.key,
                                                  },
                                                )
                                              }
                                              disabled={!frontMatterEnabled}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                                            />
                                          </label>
                                        </div>
                                        <div className="flex-1">
                                          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            値 / テンプレート
                                            <input
                                              value={draft.value}
                                              onChange={(
                                                event: ChangeEvent<HTMLInputElement>,
                                              ) =>
                                                setFrontMatterDrafts((prev) =>
                                                  prev.map((item) =>
                                                    item.id === field.id
                                                      ? {
                                                          ...item,
                                                          value:
                                                            event.target.value,
                                                        }
                                                      : item,
                                                  ),
                                                )
                                              }
                                              onBlur={() =>
                                                void handleFrontMatterFieldBlur(
                                                  field.id,
                                                  {
                                                    ...draft,
                                                    value: draft.value,
                                                  },
                                                )
                                              }
                                              disabled={!frontMatterEnabled}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                                            />
                                          </label>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            checked={draft.updateOnClip}
                                            onChange={(event) =>
                                              void toggleFrontMatterFieldUpdate(
                                                field.id,
                                                event.target.checked,
                                              )
                                            }
                                            disabled={!frontMatterEnabled}
                                            className="size-4 rounded border border-zinc-300 accent-indigo-600 disabled:opacity-60 dark:border-zinc-600"
                                          />
                                          クリップ時に値を更新する
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void removeFrontMatterField(
                                              field.id,
                                            )
                                          }
                                          className="ml-auto inline-flex items-center justify-center gap-1 rounded-xl border-2 border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:scale-105 hover:border-rose-400 hover:bg-rose-50 dark:border-rose-500/60 dark:text-rose-400 dark:hover:bg-rose-500/10"
                                          disabled={!frontMatterEnabled}
                                        >
                                          <Trash2 className="size-3" />
                                          削除
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                まだフロントマター項目がありません。上のボタンから追加してください。
                              </p>
                            )}
                          </div>
                          <div className="mt-4 rounded-lg bg-zinc-50/80 p-3 text-xs text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-300">
                            <p className="font-semibold text-zinc-700 dark:text-zinc-200">
                              利用できるプレースホルダー
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-4">
                              <li>
                                <code>{`{{title}}`}</code> — ページタイトル
                              </li>
                              <li>
                                <code>{`{{url}}`}</code> —
                                テキストフラグメント付きURL
                              </li>
                              <li>
                                <code>{`{{baseUrl}}`}</code> — ページURL
                              </li>
                              <li>
                                <code>{`{{folder}}`}</code> —
                                保存先のフォルダー名（例: DDD）
                              </li>
                              <li>
                                <code>{`{{content}}`}</code> —
                                選択したMarkdown本文
                              </li>
                              <li>
                                <code>{`{{time}}`}</code> /{" "}
                                <code>{`{{createdAt}}`}</code> —
                                クリップ時刻（フォーマット済み）
                              </li>
                              <li>
                                <code>{`{{updatedAt}}`}</code> —
                                クリップ時刻（updateOnClipを有効にすると更新）
                              </li>
                              <li>
                                <code>{`{{isoTime}}`}</code> /{" "}
                                <code>{`{{isoCreatedAt}}`}</code> /{" "}
                                <code>{`{{isoUpdatedAt}}`}</code> —
                                ISO形式の時刻
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                            保存フォーマット
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            クリップの本文を保存するMarkdownテンプレートです。プレースホルダーは本文にも利用できます。
                          </p>
                          <textarea
                            value={entryTemplateInput}
                            onChange={(
                              event: ChangeEvent<HTMLTextAreaElement>,
                            ) => setEntryTemplateInput(event.target.value)}
                            className="mt-3 h-48 w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEntryTemplate()}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/50"
                            >
                              <Save className="size-4" />
                              フォーマットを保存
                            </button>
                            <button
                              type="button"
                              onClick={() => void resetEntryTemplate()}
                              className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:scale-105 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
                            >
                              <RotateCcw className="size-4" />
                              既定に戻す
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                  テンプレートが見つかりません。新しいテンプレートを追加してください。
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="group rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg shadow-zinc-200/50 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-zinc-300/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:hover:border-zinc-700">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/30 dark:text-violet-400">
              <Monitor className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold dark:text-zinc-50">
                テーマ
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                オプションページとファイルピッカーに適用されます。
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            {(
              [
                { value: "system", label: "システム", icon: Monitor },
                { value: "light", label: "ライト", icon: Sun },
                { value: "dark", label: "ダーク", icon: Moon },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateTheme(value)}
                className={`group/theme flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold capitalize transition-all hover:scale-105 ${
                  settings.theme === value
                    ? "border-indigo-500 bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Icon className="size-4 transition-transform group-hover/theme:scale-110" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {status && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 shadow-md dark:border-indigo-800/50 dark:from-indigo-950/50 dark:to-purple-950/50">
            <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              {status}
            </p>
          </div>
        )}

        <footer className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          バージョン {chrome.runtime.getManifest().version}
        </footer>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportSettings}
        />
      </div>
    </div>
  );
}
