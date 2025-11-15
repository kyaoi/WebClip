import type { JSX } from "react";
import type { DirectoryTreeNode } from "../../shared/fileSystem";

interface TreeNodeProps {
  node: DirectoryTreeNode;
  depth?: number;
  expandedNodeIds: Set<string>;
  selectedPath: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (path: string) => void;
  onCreateDirectory?: (parentPath: string) => void;
  forceExpandAll?: boolean;
}

function TreeNode({
  node,
  depth = 0,
  expandedNodeIds,
  selectedPath,
  onToggle,
  onSelect,
  onCreateDirectory,
  forceExpandAll = false,
}: TreeNodeProps): JSX.Element {
  const isExpanded = forceExpandAll || expandedNodeIds.has(node.id);
  const isSelected = selectedPath === node.path;
  const paddingLeft = depth * 12;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg px-1 py-1 text-sm transition ${
          isSelected
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100"
            : "text-zinc-700 hover:bg-zinc-100/70 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
        }`}
        style={{ paddingLeft }}
      >
        <button
          type="button"
          aria-label={isExpanded ? "折りたたむ" : "展開する"}
          className="flex size-6 items-center justify-center rounded-md text-xs text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
          onClick={() => onToggle(node.id)}
        >
          <span aria-hidden>{isExpanded ? "▾" : "▸"}</span>
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
          onClick={() => onSelect(node.path)}
        >
          <span className="truncate">📁 {node.name}</span>
        </button>
        {onCreateDirectory && (
          <button
            type="button"
            aria-label="新しいフォルダを作成"
            className="flex size-6 items-center justify-center rounded-md text-xs text-zinc-400 opacity-0 transition hover:text-indigo-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-indigo-400"
            onClick={(e) => {
              e.stopPropagation();
              onCreateDirectory(node.path);
            }}
            title="新しいフォルダを作成"
          >
            <span aria-hidden>+</span>
          </button>
        )}
      </div>
      {isExpanded && node.children && node.children.length > 0 ? (
        <ul className="ml-4 border-l border-zinc-200/70 pl-2 dark:border-zinc-800/70">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodeIds={expandedNodeIds}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateDirectory={onCreateDirectory}
              forceExpandAll={forceExpandAll}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default TreeNode;
