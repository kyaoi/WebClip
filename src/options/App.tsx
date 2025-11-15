import type { ChangeEvent, FormEvent, JSX } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildDirectoryTree,
  createDirectory,
  type DirectoryTreeResult,
  listFolders,
} from "../shared/fileSystem";
import {
  clearRootDirectoryHandle,
  loadRootDirectoryHandle,
  saveRootDirectoryHandle,
} from "../shared/handles";
import { getSettings, updateSettings } from "../shared/settings";
import { applyTheme } from "../shared/theme";
import type {
  CategorySetting,
  CategorySubfolder,
  Settings,
  TemplateFrontMatterField,
  TemplateSetting,
  ThemePreference,
} from "../shared/types";
import { DEFAULT_ENTRY_TEMPLATE } from "../shared/types";
import SidebarTreePanel from "./components/SidebarTreePanel";

function createDefaultTemplate(name: string): TemplateSetting {
  return {
    id: crypto.randomUUID(),
    name,
    useDomainSubfolders: true,
    singleFilePath: "inbox.md",
    categories: [],
    categoryAggregateFileName: "inbox.md",
    frontMatter: {
      enabled: false,
      fields: [],
    },
    entryTemplate: DEFAULT_ENTRY_TEMPLATE,
  };
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [singleFileInput, setSingleFileInput] = useState("");
  const [aggregateFileNameInput, setAggregateFileNameInput] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(
    {},
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [templateNameInput, setTemplateNameInput] = useState("");
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
  const aggregateInputId = useId();
  const folderDatalistId = useId();
  const templateNameInputId = useId();
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
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

  const templates = useMemo(() => settings?.templates ?? [], [settings]);
  const selectedTemplate = useMemo(() => {
    if (!templates.length) {
      return null;
    }
    if (selectedTemplateId) {
      const match = templates.find(
        (template) => template.id === selectedTemplateId,
      );
      if (match) {
        return match;
      }
    }
    return templates[0];
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!settings) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId((prev) => {
      if (prev && settings.templates.some((template) => template.id === prev)) {
        return prev;
      }
      return settings.activeTemplateId || settings.templates[0]?.id || null;
    });
  }, [settings]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSingleFileInput("");
      setAggregateFileNameInput("");
      setCategoryDrafts({});
      setTemplateNameInput("");
      setFrontMatterEnabled(false);
      setFrontMatterDrafts([]);
      setEntryTemplateInput("");
      previousTemplateIdRef.current = null;
      treeTemplateIdRef.current = null;
      setSelectedTreePath(null);
      return;
    }
    setSingleFileInput(selectedTemplate.singleFilePath);
    setAggregateFileNameInput(selectedTemplate.categoryAggregateFileName);
    setCategoryDrafts(
      Object.fromEntries(
        selectedTemplate.categories.map((category) => [
          category.id,
          category.label,
        ]),
      ),
    );
    setTemplateNameInput(selectedTemplate.name);
    setFrontMatterEnabled(selectedTemplate.frontMatter.enabled);
    setFrontMatterDrafts((prev) => {
      const saved = selectedTemplate.frontMatter.fields.map((field) => ({
        ...field,
      }));
      if (previousTemplateIdRef.current !== selectedTemplate.id) {
        previousTemplateIdRef.current = selectedTemplate.id;
        return saved;
      }
      const unsaved = prev.filter(
        (field) =>
          !selectedTemplate.frontMatter.fields.some(
            (savedField) => savedField.id === field.id,
          ),
      );
      previousTemplateIdRef.current = selectedTemplate.id;
      return [...saved, ...unsaved];
    });
    setEntryTemplateInput(selectedTemplate.entryTemplate);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    if (treeTemplateIdRef.current !== selectedTemplate.id) {
      treeTemplateIdRef.current = selectedTemplate.id;
      setSelectedTreePath(selectedTemplate.singleFilePath);
    }
  }, [selectedTemplate]);

  const templateCount = templates.length;
  const isSelectedTemplateActive = Boolean(
    selectedTemplate && settings?.activeTemplateId === selectedTemplate.id,
  );

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
    if (settings?.rootFolderName) {
      void refreshFolderOptions({ silent: true });
    } else {
      setFolderOptions([]);
    }
  }, [refreshFolderOptions, settings?.rootFolderName]);

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
        setExpandedNodeIds((prev) => {
          if (prev.size) {
            return prev;
          }
          const next = new Set<string>();
          result.nodes
            .filter((node) => node.kind === "directory")
            .forEach((node) => {
              next.add(node.id);
            });
          return next;
        });
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
      } else {
        setStatus(result.error ?? "フォルダの作成に失敗しました。");
      }
    },
    [refreshDirectoryTree],
  );

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

  async function setTemplateAsDefault(templateId: string): Promise<void> {
    if (!settings) {
      return;
    }
    const updated = await updateSettings({ activeTemplateId: templateId });
    setSettings(updated);
    setStatus("既定のテンプレートを更新しました。");
  }

  async function addTemplate(): Promise<void> {
    if (!settings) {
      return;
    }
    const baseName = `Template ${settings.templates.length + 1}`;
    const nextTemplate = createDefaultTemplate(baseName);
    const updated = await updateSettings({
      templates: [...settings.templates, nextTemplate],
    });
    setSettings(updated);
    setSelectedTemplateId(nextTemplate.id);
    setStatus(`テンプレート「${baseName}」を追加しました。`);
  }

  async function removeTemplateSetting(templateId: string): Promise<void> {
    if (!settings) {
      return;
    }
    if (settings.templates.length <= 1) {
      setStatus("テンプレートは少なくとも1つ必要です。");
      return;
    }
    const target = settings.templates.find(
      (template) => template.id === templateId,
    );
    if (!target) {
      return;
    }
    const nextTemplates = settings.templates.filter(
      (template) => template.id !== templateId,
    );
    const nextActiveId =
      settings.activeTemplateId === templateId
        ? (nextTemplates[0]?.id ?? null)
        : settings.activeTemplateId;
    const updated = await updateSettings({
      templates: nextTemplates,
      activeTemplateId: nextActiveId ?? undefined,
    });
    setSettings(updated);
    setSelectedTemplateId((prev) => {
      if (prev === templateId) {
        return nextActiveId ?? nextTemplates[0]?.id ?? null;
      }
      return prev;
    });
    setStatus(
      target
        ? `テンプレート「${target.name}」を削除しました。`
        : "テンプレートを削除しました。",
    );
  }

  async function saveTemplateName(): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const trimmed = templateNameInput.trim();
    if (!trimmed) {
      setTemplateNameInput(selectedTemplate.name);
      setStatus("テンプレート名を入力してください。");
      return;
    }
    if (trimmed === selectedTemplate.name) {
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      name: trimmed,
    }));
    setStatus(`テンプレート名を「${trimmed}」に更新しました。`);
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

  async function handleAggregateFileSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!selectedTemplate) {
      return;
    }
    const trimmed = aggregateFileNameInput.trim();
    if (!trimmed) {
      setStatus("集約ファイル名を入力してください。");
      return;
    }
    const normalized = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categoryAggregateFileName: normalized,
    }));
    setStatus(`カテゴリ集約ファイル名を ${normalized} に更新しました。`);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedTemplate) {
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
      aggregate: false,
      subfolders: [],
    };
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: [...template.categories, nextCategory],
    }));
    setNewCategoryLabel("");
    setStatus(`カテゴリ「${label}」を追加しました。`);
  }

  async function handleCategoryBlur(id: string, label?: string): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const draft = label ?? categoryDrafts[id];
    const current = selectedTemplate.categories.find((item) => item.id === id);
    if (!draft || !current) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      setStatus("カテゴリ名を入力してください。");
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.map((item) =>
        item.id === id ? { ...item, label: trimmed } : item,
      ),
    }));
    setStatus(`カテゴリ「${trimmed}」を更新しました。`);
  }

  async function toggleCategoryAggregate(
    id: string,
    next: boolean,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const current = selectedTemplate.categories.find((item) => item.id === id);
    if (!current) {
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.map((item) =>
        item.id === id ? { ...item, aggregate: next } : item,
      ),
    }));
    setStatus(
      next
        ? `カテゴリ「${current.label}」は集約ファイルに保存します。`
        : `カテゴリ「${current.label}」はページごとのファイルに保存します。`,
    );
  }

  async function removeCategory(id: string): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const target = selectedTemplate.categories.find((item) => item.id === id);
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.filter((item) => item.id !== id),
    }));
    setCategoryDrafts((prev) => {
      const nextDrafts = { ...prev };
      delete nextDrafts[id];
      return nextDrafts;
    });
    setStatus(
      target
        ? `カテゴリ「${target.label}」を削除しました。`
        : "カテゴリを削除しました。",
    );
  }

  async function addSubfolder(
    categoryId: string,
    subfolderName: string,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const trimmed = subfolderName.trim();
    if (!trimmed) {
      setStatus("サブフォルダ名を入力してください。");
      return;
    }
    const newSubfolder: CategorySubfolder = {
      id: crypto.randomUUID(),
      name: trimmed,
      aggregate: false,
    };
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, subfolders: [...cat.subfolders, newSubfolder] }
          : cat,
      ),
    }));
    const category = selectedTemplate.categories.find(
      (cat) => cat.id === categoryId,
    );
    setStatus(
      category
        ? `カテゴリ「${category.label}」にサブフォルダ「${trimmed}」を追加しました。`
        : "サブフォルダを追加しました。",
    );
  }

  async function toggleSubfolderAggregate(
    categoryId: string,
    subfolderId: string,
    next: boolean,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              subfolders: cat.subfolders.map((sub) =>
                sub.id === subfolderId ? { ...sub, aggregate: next } : sub,
              ),
            }
          : cat,
      ),
    }));
  }

  async function removeSubfolder(
    categoryId: string,
    subfolderId: string,
  ): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    const category = selectedTemplate.categories.find(
      (cat) => cat.id === categoryId,
    );
    const subfolder = category?.subfolders.find(
      (sub) => sub.id === subfolderId,
    );
    await applyTemplateUpdate(selectedTemplate.id, (template) => ({
      ...template,
      categories: template.categories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              subfolders: cat.subfolders.filter(
                (sub) => sub.id !== subfolderId,
              ),
            }
          : cat,
      ),
    }));
    setStatus(
      subfolder
        ? `サブフォルダ「${subfolder.name}」を削除しました。`
        : "サブフォルダを削除しました。",
    );
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
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1 text-balance">
          <h1 className="text-3xl font-semibold tracking-tight">
            WebClip 設定
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            保存先フォルダとテンプレートをカスタマイズして、選択した文章をすばやくMarkdownへ。
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
          <h2 className="text-lg font-medium">テンプレート</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            テンプレートごとに保存先のルールやフロントマター、本文フォーマットを設定できます。
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
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
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {templates.map((template) => {
                      const isSelected = selectedTemplate?.id === template.id;
                      const isActive =
                        settings.activeTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-200"
                              : "border-zinc-200 text-zinc-600 hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          <span>{template.name}</span>
                          {isActive ? (
                            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                              既定
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => void addTemplate()}
                      className="rounded-full border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      + テンプレート追加
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void exportSettingsToFile()}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      設定をエクスポート
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      設定をインポート
                    </button>
                  </div>
                </div>
              </div>

              {selectedTemplate ? (
                <div className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor={templateNameInputId}
                        className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        テンプレート名
                      </label>
                      <input
                        id={templateNameInputId}
                        value={templateNameInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setTemplateNameInput(event.target.value)
                        }
                        onBlur={() => void saveTemplateName()}
                        className="rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void setTemplateAsDefault(selectedTemplate.id)
                        }
                        disabled={Boolean(isSelectedTemplateActive)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          isSelectedTemplateActive
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-200"
                            : "border-zinc-200 text-zinc-600 hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {isSelectedTemplateActive
                          ? "既定のテンプレート"
                          : "既定に設定"}
                      </button>
                      {templateCount > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            void removeTemplateSetting(selectedTemplate.id)
                          }
                          className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-500 transition hover:border-rose-500 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300"
                        >
                          テンプレートを削除
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-700"
                            checked={selectedTemplate.useDomainSubfolders}
                            onChange={(event) =>
                              toggleDomainSubfolders(event.target.checked)
                            }
                          />
                          <span>
                            ドメインごとにサブフォルダを作成してページ単位のMarkdownを保存する
                            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                              例: example.com の記事 →{" "}
                              <code>example-com/記事タイトル.md</code>
                            </span>
                          </span>
                        </label>
                      </div>

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
                          例: <code>inbox.md</code> や{" "}
                          <code>notes/inbox.md</code>
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
                          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <label
                            htmlFor={aggregateInputId}
                            className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                          >
                            集約ファイル名
                          </label>
                          <div className="flex flex-1 gap-2">
                            <input
                              id={aggregateInputId}
                              value={aggregateFileNameInput}
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>,
                              ) =>
                                setAggregateFileNameInput(event.target.value)
                              }
                              placeholder="inbox.md"
                              className="flex-1 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              更新
                            </button>
                          </div>
                        </form>

                        <div className="mt-4 flex flex-col gap-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                            {settings.rootFolderName ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                保存先フォルダ配下のサブフォルダ候補を利用できます。
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600 dark:text-amber-300">
                                先に保存先フォルダを設定してください。
                              </p>
                            )}
                          </div>
                          {folderOptions.length > 0 && (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                検出されたサブフォルダ ({folderOptions.length}
                                個):
                              </p>
                              <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                                {folderOptions.map((folder) => (
                                  <span
                                    key={folder}
                                    className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                                  >
                                    📁 {folder}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <datalist id={folderDatalistId}>
                          {folderOptions.map((folder) => (
                            <option key={folder} value={folder} />
                          ))}
                        </datalist>

                        {selectedTemplate.categories.length ? (
                          <ul className="mt-4 space-y-3">
                            {selectedTemplate.categories.map((category) => {
                              const draft =
                                categoryDrafts[category.id] ?? category.label;
                              return (
                                <li
                                  key={category.id}
                                  className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/70"
                                >
                                  <div className="flex flex-col gap-3">
                                    <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                      カテゴリ名（ディレクトリ名）
                                      <input
                                        value={draft}
                                        onChange={(
                                          event: ChangeEvent<HTMLInputElement>,
                                        ) =>
                                          setCategoryDrafts((prev) => ({
                                            ...prev,
                                            [category.id]: event.target.value,
                                          }))
                                        }
                                        onBlur={() =>
                                          void handleCategoryBlur(
                                            category.id,
                                            draft,
                                          )
                                        }
                                        className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                                      />
                                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        この名前がそのままディレクトリ名になります
                                      </p>
                                    </label>

                                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                          📁 サブフォルダ
                                        </h4>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const name = prompt(
                                              "サブフォルダ名を入力してください:",
                                            );
                                            if (name) {
                                              void addSubfolder(
                                                category.id,
                                                name,
                                              );
                                            }
                                          }}
                                          className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-600 transition hover:border-indigo-400 dark:border-indigo-400/50 dark:bg-indigo-900/50 dark:text-indigo-200"
                                        >
                                          + 追加
                                        </button>
                                      </div>
                                      {category.subfolders.length > 0 ? (
                                        <ul className="mt-3 space-y-2">
                                          {category.subfolders.map(
                                            (subfolder) => (
                                              <li
                                                key={subfolder.id}
                                                className="rounded-lg border border-zinc-200 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/80"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex-1">
                                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                                      {subfolder.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                      {category.label}/
                                                      {subfolder.name}/
                                                      {subfolder.aggregate
                                                        ? selectedTemplate.categoryAggregateFileName
                                                        : "<ページタイトル>.md"}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <label className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                                                      <input
                                                        type="checkbox"
                                                        checked={
                                                          subfolder.aggregate
                                                        }
                                                        onChange={(event) =>
                                                          void toggleSubfolderAggregate(
                                                            category.id,
                                                            subfolder.id,
                                                            event.target
                                                              .checked,
                                                          )
                                                        }
                                                        className="size-3 rounded border border-zinc-300 accent-indigo-600 dark:border-zinc-600"
                                                      />
                                                      集約
                                                    </label>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        void removeSubfolder(
                                                          category.id,
                                                          subfolder.id,
                                                        )
                                                      }
                                                      className="rounded-full border border-rose-200 px-2 py-0.5 text-xs text-rose-500 transition hover:border-rose-400 dark:border-rose-500/60 dark:text-rose-300"
                                                    >
                                                      削除
                                                    </button>
                                                  </div>
                                                </div>
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      ) : (
                                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                          サブフォルダはまだありません。「+
                                          追加」ボタンから追加してください。
                                        </p>
                                      )}
                                    </div>

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
                                        カテゴリ直下は集約ファイル（
                                        {
                                          selectedTemplate.categoryAggregateFileName
                                        }
                                        ）に保存
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void removeCategory(category.id)
                                        }
                                        className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-400 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300"
                                      >
                                        カテゴリを削除
                                      </button>
                                    </div>
                                    <p className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400">
                                      💾{" "}
                                      <span className="font-semibold">
                                        カテゴリ直下の保存パス例:
                                      </span>{" "}
                                      <code className="rounded bg-white px-1.5 py-0.5 font-mono dark:bg-zinc-900">
                                        {category.label}/
                                        {category.aggregate
                                          ? selectedTemplate.categoryAggregateFileName
                                          : "<ページタイトル>.md"}
                                      </code>
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                            まだカテゴリがありません。上のフォームから追加してください。
                          </p>
                        )}
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
                              className="self-start rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              + 項目を追加
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
                                          className="ml-auto inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-400 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300"
                                          disabled={!frontMatterEnabled}
                                        >
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
                              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                            >
                              フォーマットを保存
                            </button>
                            <button
                              type="button"
                              onClick={() => void resetEntryTemplate()}
                              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                            >
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
