import {
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { type JSX, useMemo } from "react";
import type { DirectoryTreeNode } from "../../shared/fileSystem";
import TreeNode from "./TreeNode";

interface SidebarTreePanelProps {
  folderLabel: string;
  hasRootFolder: boolean;
  rootName: string | null;
  nodes: DirectoryTreeNode[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  expandedNodeIds: Set<string>;
  onToggleNode: (nodeId: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onCreateDirectory: (parentPath: string) => void;
  onChooseFolder: () => void;
  onReloadTree: () => void;
  onReRequestPermission: () => void;
  isLoading: boolean;
  requiresPermission: boolean;
  treeError: string | null;
  truncated: boolean;
  totalCount: number;
}

function SidebarTreePanel({
  folderLabel,
  hasRootFolder,
  rootName,
  nodes,
  searchQuery,
  onSearchChange,
  expandedNodeIds,
  onToggleNode,
  selectedPath,
  onSelectPath,
  onCreateDirectory,
  onChooseFolder,
  onReloadTree,
  onReRequestPermission,
  isLoading,
  requiresPermission,
  treeError,
  truncated,
  totalCount,
}: SidebarTreePanelProps): JSX.Element {
  const query = searchQuery.trim();
  const filteredNodes = useMemo(
    () => (query ? filterNodes(nodes, query) : nodes),
    [nodes, query],
  );
  const forceExpandAll = Boolean(query);

  return (
    <aside className="flex h-[calc(100vh-10rem)] flex-col rounded-2xl border-2 border-zinc-200/80 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-col gap-4 border-b-2 border-zinc-100 pb-5 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/30 dark:text-emerald-400">
            <FolderPlus className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              保存先フォルダ
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {folderLabel}
            </p>
            {rootName ? (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                ({rootName})
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChooseFolder}
            className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/50 dark:shadow-emerald-500/20 dark:hover:shadow-emerald-500/40"
          >
            <FolderOpen className="size-4 transition-transform group-hover/btn:scale-110" />
            選択
          </button>
          <button
            type="button"
            onClick={onReloadTree}
            className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-700 transition-all hover:scale-105 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-500"
          >
            <RefreshCw className="size-4 transition-transform group-hover/btn:rotate-180" />
            更新
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ディレクトリ名で検索"
            className="w-full rounded-xl border-2 border-zinc-200 bg-white pl-10 pr-3 py-2.5 text-sm text-zinc-800 shadow-inner transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-600 dark:focus:ring-emerald-500/30"
          />
        </div>
      </div>
      {hasRootFolder && !requiresPermission && !treeError && (
        <button
          type="button"
          onClick={() => onCreateDirectory("")}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm transition-all hover:scale-105 hover:border-emerald-400 hover:shadow-md dark:border-emerald-800 dark:0bg-gradient-to-r dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-400 dark:hover:border-emerald-700 dark:shadow-none"
        >
          <FolderPlus className="size-5" />
          新しいカテゴリを作成
        </button>
      )}
      <div className="mt-4 flex-1 overflow-hidden">
        <div className="h-full rounded-xl border-2 border-dashed border-zinc-200 bg-white/60 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
          {isLoading ? (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              ツリーを読み込み中…
            </p>
          ) : !hasRootFolder ? (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 size-4 flex-shrink-0" />
              <p>先に保存先フォルダを設定してください。</p>
            </div>
          ) : requiresPermission ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 size-4 flex-shrink-0" />
                <p>
                  フォルダへのアクセス権限が必要です。「権限を再確認」を押してください。
                </p>
              </div>
              <button
                type="button"
                onClick={onReRequestPermission}
                className="self-start inline-flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition-all hover:scale-105 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                <ShieldAlert className="size-3" />
                権限を再確認
              </button>
            </div>
          ) : treeError ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {treeError}
            </p>
          ) : filteredNodes.length ? (
            <div className="h-full overflow-auto pr-1 scrollbar-custom">
              <ul className="space-y-0.5">
                {filteredNodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    expandedNodeIds={expandedNodeIds}
                    selectedPath={selectedPath}
                    onToggle={onToggleNode}
                    onSelect={onSelectPath}
                    onCreateDirectory={onCreateDirectory}
                    forceExpandAll={forceExpandAll}
                  />
                ))}
              </ul>
            </div>
          ) : query ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              「{query}」に一致する項目はありません。
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ディレクトリが見つかりませんでした。
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-zinc-50/80 px-4 py-3 dark:bg-zinc-800/50">
        {selectedPath ? (
          <div className="flex items-start gap-2">
            <FolderOpen className="mt-0.5 size-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                選択中
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {selectedPath}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            ツリーから参照したいパスを選択してください。
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          合計 {totalCount} 件 {truncated ? "(一部省略)" : ""}
        </p>
      </div>
    </aside>
  );
}

function filterNodes(
  nodes: DirectoryTreeNode[],
  query: string,
): DirectoryTreeNode[] {
  const normalized = query.toLowerCase();
  return nodes
    .map((node) => {
      if (node.kind === "directory") {
        const children = node.children ? filterNodes(node.children, query) : [];
        if (node.name.toLowerCase().includes(normalized) || children?.length) {
          return {
            ...node,
            children,
          } satisfies DirectoryTreeNode;
        }
        return null;
      }
      if (node.name.toLowerCase().includes(normalized)) {
        return { ...node } satisfies DirectoryTreeNode;
      }
      return null;
    })
    .filter((node): node is DirectoryTreeNode => Boolean(node));
}

export default SidebarTreePanel;
