import type { JSX } from "react";
import { useState } from "react";
import type { DirectoryTreeNode as TreeNode } from "../../shared/fileSystem";

interface DirectoryTreeNodeProps {
  node: TreeNode;
  onSelectDirectory: (path: string, mode: "aggregate" | "page") => void;
  saving: boolean;
  aggregateFileName: string;
  depth?: number;
}

function DirectoryTreeNode({
  node,
  onSelectDirectory,
  saving,
  aggregateFileName,
  depth = 0,
}: DirectoryTreeNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(depth === 0);

  return (
    <li className="text-sm">
      <div
        className={`flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/70 ${
          depth === 0 ? "" : "ml-4"
        }`}
      >
        <div className="flex items-center gap-2">
          {node.children && node.children.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex size-6 items-center justify-center text-xs text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              aria-label={isExpanded ? "折りたたむ" : "展開する"}
            >
              <span aria-hidden>{isExpanded ? "▾" : "▸"}</span>
            </button>
          )}
          <span className="flex-1 font-semibold text-zinc-800 dark:text-zinc-100">
            📁 {node.name}
          </span>
        </div>

        <div className="ml-8 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectDirectory(node.path, "page")}
            disabled={saving}
            className="rounded-lg border border-indigo-200 bg-white/80 px-3 py-2 text-xs font-medium transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-500/50 dark:bg-zinc-900/80"
          >
            📄 ページごと
            <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
              {node.path}/{"<タイトル>.md"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelectDirectory(node.path, "aggregate")}
            disabled={saving}
            className="rounded-lg border border-indigo-500 bg-indigo-50/80 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-200"
          >
            📝 集約
            <span className="mt-0.5 block text-[10px] font-normal text-indigo-600/80 dark:text-indigo-300/80">
              {node.path}/{aggregateFileName}
            </span>
          </button>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-zinc-200 pl-2 dark:border-zinc-700">
          {node.children.map((child) => (
            <DirectoryTreeNode
              key={child.id}
              node={child}
              onSelectDirectory={onSelectDirectory}
              saving={saving}
              aggregateFileName={aggregateFileName}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default DirectoryTreeNode;
