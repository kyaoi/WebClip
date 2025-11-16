import type { JSX } from "react";
import { useState } from "react";
import type { DirectoryTreeNode } from "../../shared/fileSystem";

interface CategoryTreeNodeProps {
  node: DirectoryTreeNode;
  onSelectCategory: (
    path: string,
    mode: "aggregate" | "page",
  ) => void;
  saving: boolean;
  aggregateFileName: string;
  level?: number;
}

function CategoryTreeNode({
  node,
  onSelectCategory,
  saving,
  aggregateFileName,
  level = 0,
}: CategoryTreeNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.filter(n => n.kind === "directory").length > 0;

  return (
    <li className="text-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/70 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex size-5 items-center justify-center text-xs text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              aria-label={isExpanded ? "折りたたむ" : "展開する"}
            >
              <span aria-hidden>{isExpanded ? "▾" : "▸"}</span>
            </button>
          ) : (
            <span className="size-5" />
          )}
          
          <span className="flex-1 text-xs font-medium text-zinc-800 dark:text-zinc-100">
            📁 {node.name}
          </span>
          
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => void onSelectCategory(node.path, "page")}
              disabled={saving}
              className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-medium transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/50"
              title="ページごと"
            >
              📄
            </button>
            <button
              type="button"
              onClick={() => void onSelectCategory(node.path, "aggregate")}
              disabled={saving}
              className="rounded border border-indigo-500 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/50"
              title="集約"
            >
              📝
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <ul className="ml-6 space-y-1 border-l-2 border-zinc-200 pl-2 dark:border-zinc-700">
            {node.children!
              .filter(child => child.kind === "directory")
              .map((child) => (
                <CategoryTreeNode
                  key={child.id}
                  node={child}
                  onSelectCategory={onSelectCategory}
                  saving={saving}
                  aggregateFileName={aggregateFileName}
                  level={level + 1}
                />
              ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default CategoryTreeNode;
