# WebClip — Chrome Extension (MVP)

> Save selected text on the web into local **Markdown** files. No cloud, no lock‑in. Obsidian is just one way to use the notes.

---

## 🧰 Tech Stack (updated)
- **React + TypeScript + Tailwind CSS**
- **Vite** build with **Manifest V3** (MV3). Recommended plugin: `@crxjs/vite-plugin`
- File System Access API (local only). **No network calls / telemetry**

---

## ✨ What it does
- **Right‑click → Save to Markdown**
  - **perPage (default)**: append to `<page-title>.md` under a chosen folder (create if missing)
  - **existingFilePick**: pick an existing `.md` and append (can create a new file)
- Automatically stores context:
  - Timestamp (`YYYY-MM-DD HH:mm`)
  - Selected quote (as Markdown blockquote)
  - Source link (with **Text Fragment** when possible)
  - **Nearest link** around the selection (if any)
- **Duplicate guard** per file (hash of selection + URL)
- Toast notifications for success/failure
- Light / dark / system-aware theme for Options & Picker pages
- 100% **local** (no network)

---

## 🛠 Install (Dev)
1) **Prereqs**: Node.js ≥ 18 (LTS), pnpm  
2) Install deps:
   ```bash
   pnpm i
   ```
3) Build (watch) to `dist/`:
   ```bash
   pnpm run dev:ext
   ```
   or one‑shot build:
   ```bash
   pnpm run build
   ```
4) Open `chrome://extensions` → **Developer mode ON** → **Load unpacked** → select `dist/`

Quality gates (Biome):
```bash
pnpm run lint
pnpm run format
```

> The project uses Vite with MV3. Each page (options, picker, offscreen) has its own HTML entry the bundler outputs to `dist/`.

---

## 🚀 Usage
### perPage (default)
Select text → **Right‑click → Save to Markdown**.  
Computed file: `<save-folder>/<Subfolder>/<page-title>.md`. Appends a block (creates file if missing).

### existingFilePick
Select text → **Right‑click → Save to existing file…**  
A small picker lists `.md` files (recursive), shows **MRU (recent 5)**, supports search (prefix & substring), and **new file** creation.

---

## 📝 Output format
Template (conceptual):
```md
### ${ts}
> ${selection}

- source: [${title}](${urlFrag})
- link: [${linkText}](${linkUrl})  <!-- only when a nearby link exists -->
```

Template variables: `ts`, `selection`, `title`, `url`, `urlFrag`, `linkUrl`, `linkText`.

---

## 📁 Naming & Duplicates
- perPage filename: slugified title → `<title>.md` (emoji/marks removed, spaces→`-`, lowercase, 80‑char cap)
- Existing → append; missing → create
- Duplicate guard: `sha1(selection + '|' + url)` comment per file

---

## 🔐 Privacy & Permissions
- Uses **File System Access API**; write only within the user‑granted folder
- **No network**; no telemetry

---

## ⚠️ Known limitations
- Chromium only (Chrome/Edge/Brave). Firefox/Safari not supported due to FSA
- Some pages (PDF viewers, strict CSP, complex iframes) may limit selection/nearby‑link detection
- Large Markdown files (>1MB) rewritten wholly (slower)
- Text Fragment may not scroll precisely on every site

---

## 🤝 Contributing
See **CONTRIBUTING.md**. Development rules in **DEVELOPMENT.md** (React + TypeScript + Tailwind guidance).

---

## 📄 License
MIT

_Last updated: 2025-10-30 19:00_



## TODO: 保存先のカスタマイズ機能

現在の保存機能に加え、より柔軟な保存スタイルを選択できる機能を追加する。
機能は右クリックメニューから利用可能にし、詳細な設定はオプションページまたはポップアップページで行えるようにする。

1.  **単一ファイルスタイル**
    *   すべてのクリップを、ユーザーが指定した単一のファイル（例：`inbox.md`）に時系列で追記する。
    *   素早くメモを取りためる用途に最適。

2.  **カテゴリ分類スタイル**
    *   クリップ時に「技術」「趣味」などのカテゴリを選択し、分類して保存する。
    *   保存先は `/カテゴリ名/ページタイトル.md` のように、自動で整理される。
    *   オプションで、カテゴリごとの集約ファイル（`/カテゴリ名/inbox.md`）への保存も選択可能にする。

3.  **ファイルピッカーの強化**
    *   既存のファイル選択機能を強化し、保存先フォルダ内のすべてのMarkdownファイルを再帰的に検索・選択できるようにする。
