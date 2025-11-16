import type { JSX } from "react";
import { useState } from "react";
import type { CategorySetting } from "../../shared/types";

interface CategoryTreeNodeProps {
  category: CategorySetting;
  onSelectCategory: (
    categoryId: string,
    mode: "aggregate" | "page",
    subfolderId?: string,
  ) => void;
  saving: boolean;
  aggregateFileName: string;
}

function CategoryTreeNode({
  category,
  onSelectCategory,
  saving,
  aggregateFileName,
}: CategoryTreeNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li className="rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {category.subfolders.length > 0 && (
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
            📁 {category.label}
          </span>
        </div>

        <div className="ml-8 flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void onSelectCategory(category.id, "page")}
              disabled={saving}
              className="rounded-lg border border-indigo-200 bg-white/80 px-3 py-2 text-xs font-medium transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-500/50 dark:bg-zinc-900/80"
            >
              📄 ページごと
              <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                {category.label}/{"<タイトル>.md"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void onSelectCategory(category.id, "aggregate")}
              disabled={saving}
              className="rounded-lg border border-indigo-500 bg-indigo-50/80 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-200"
            >
              📝 集約
              <span className="mt-0.5 block text-[10px] font-normal text-indigo-600/80 dark:text-indigo-300/80">
                {category.label}/{aggregateFileName}
              </span>
            </button>
          </div>

          {isExpanded && category.subfolders.length > 0 && (
            <ul className="mt-1 space-y-2 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
              {category.subfolders.map((subfolder) => (
                <li
                  key={subfolder.id}
                  className="rounded-lg border border-zinc-200 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/60"
                >
                  <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    📂 {subfolder.name}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        void onSelectCategory(category.id, "page", subfolder.id)
                      }
                      disabled={saving}
                      className="rounded border border-indigo-200 bg-white px-2 py-1.5 text-[10px] transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-500/50 dark:bg-zinc-900/80"
                    >
                      📄 ページごと
                      <span className="mt-0.5 block text-[9px] text-zinc-500 dark:text-zinc-400">
                        {category.label}/{subfolder.name}/{"<タイトル>.md"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void onSelectCategory(
                          category.id,
                          "aggregate",
                          subfolder.id,
                        )
                      }
                      disabled={saving}
                      className="rounded border border-indigo-400 bg-indigo-50 px-2 py-1.5 text-[10px] text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-200"
                    >
                      📝 集約
                      <span className="mt-0.5 block text-[9px] text-indigo-600/80 dark:text-indigo-300/80">
                        {category.label}/{subfolder.name}/{aggregateFileName}
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export default CategoryTreeNode;
