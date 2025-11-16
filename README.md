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
- **Single-file inbox**: collect every clip into a user-defined Markdown file (e.g. `inbox.md`) via the “Save to inbox file” context menu. Configure the path from the Options or Popup page.
- **Category clipping**: choose a category at save time to organise notes under `/カテゴリ名/ページタイトル.md`, or aggregate into `/カテゴリ名/inbox.md` when that category’s inbox mode is enabled.
- **Directory tree management**: 
  - View only directories in the tree (files are hidden for clarity)
  - Create new directories directly from the tree with a single click
  - Directory-specific templates (data structure ready, UI implementation planned)
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
Right-click with text selected to open these menu items:

- **Save to Markdown (per page)**
- **Save to inbox file**
- **Save to category…**
- **Save to existing file…**

### perPage (default)
Select text → **Right‑click → Save to Markdown**.  
Computed file: `<save-folder>/<Subfolder>/<page-title>.md`. Appends a block (creates file if missing).

### singleFile (Save to inbox file)
Select text → **Right-click → Save to inbox file**.  
Appends to the single Markdown file configured in Options / Popup (creates it on first run).

### category (Save to category…)
Select text → **Right-click → Save to category…** → pick a category from the **tree view**.  
Categories are displayed in a hierarchical tree structure with expandable subfolders. Each category uses its label directly as the directory name. You can choose to save to:
- `/CategoryName/<page-title>.md` (per-page mode)
- `/CategoryName/inbox.md` (aggregate mode)
- `/CategoryName/SubfolderName/<page-title>.md` (subfolder per-page mode)
- `/CategoryName/SubfolderName/inbox.md` (subfolder aggregate mode)

### existingFilePick
Select text → **Right-click → Save to existing file…**  
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

## ⚙️ Customizing save styles
- **Options / Popup → Save style**
  - Toggle domain-based subfolders for per-page saves.
  - Set the inbox file path (auto-appends `.md` if omitted).
  - Add, rename, or remove categories. **Category names are used directly as directory names**.
  - Configure subfolder behavior for each category.
  - Set the shared category inbox filename (default `inbox.md`).
  - **Tree view**: Browse your directory structure and create new directories with a single click.
- Settings persist locally in Chrome storage + File System Access handles. Reopen Options whenever permissions need to be refreshed.

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

_Last updated: 2025-11-03 10:00_
