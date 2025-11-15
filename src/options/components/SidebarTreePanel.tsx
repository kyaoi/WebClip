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
    <aside className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            保存先フォルダ
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {folderLabel}
          </p>
          {rootName ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ({rootName})
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChooseFolder}
            className="flex-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            フォルダを選択
          </button>
          <button
            type="button"
            onClick={onReloadTree}
            className="flex-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            ツリーを更新
          </button>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ディレクトリ名で検索"
          className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-800 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100"
        />
      </div>
      <div className="mt-4 flex-1 overflow-hidden">
        <div className="h-full rounded-xl border border-dashed border-zinc-200 bg-white/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          {isLoading ? (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              ツリーを読み込み中…
            </p>
          ) : !hasRootFolder ? (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              先に保存先フォルダを設定してください。
            </p>
          ) : requiresPermission ? (
            <div className="flex flex-col gap-3 text-xs text-amber-600 dark:text-amber-300">
              <p>
                フォルダへのアクセス権限が必要です。「権限を再確認」を押してください。
              </p>
              <button
                type="button"
                onClick={onReRequestPermission}
                className="self-start rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/70 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                権限を再確認
              </button>
            </div>
          ) : treeError ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">
              {treeError}
            </p>
          ) : filteredNodes.length ? (
            <div className="h-full overflow-auto pr-1">
              <ul className="space-y-0.5">
                {filteredNodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    expandedNodeIds={expandedNodeIds}
                    selectedPath={selectedPath}
                    onToggle={onToggleNode}
                    onSelect={onSelectPath}
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
      <div className="mt-4 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        {selectedPath ? (
          <p>
            選択中:{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {selectedPath}
            </span>
          </p>
        ) : (
          <p>ツリーから参照したいパスを選択してください。</p>
        )}
        <p>
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
