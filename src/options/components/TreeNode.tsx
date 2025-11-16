import { ChevronDown, ChevronRight, Folder, FolderPlus } from "lucide-react";
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
        className={`group flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition-all ${
          isSelected
            ? "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 shadow-sm dark:from-emerald-950/50 dark:to-teal-950/50 dark:text-emerald-300"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
        style={{ paddingLeft }}
      >
        <button
          type="button"
          aria-label={isExpanded ? "折りたたむ" : "展開する"}
          className="flex size-6 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-200/50 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          onClick={() => onToggle(node.id)}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left transition-all hover:bg-white/50 dark:hover:bg-zinc-800/50"
          onClick={() => onSelect(node.path)}
        >
          <Folder
            className={`size-4 flex-shrink-0 ${
              isSelected
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          />
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {onCreateDirectory && (
          <button
            type="button"
            aria-label="新しいフォルダを作成"
            className="flex size-7 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-all hover:bg-emerald-100 hover:text-emerald-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400"
            onClick={(e) => {
              e.stopPropagation();
              onCreateDirectory(node.path);
            }}
            title="新しいフォルダを作成"
          >
            <FolderPlus className="size-4" />
          </button>
        )}
      </div>
      {isExpanded && node.children && node.children.length > 0 ? (
        <ul className="ml-4 border-l-2 border-zinc-200/70 pl-2 dark:border-zinc-700/70">
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
