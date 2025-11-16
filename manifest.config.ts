import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "WebClip",
  version: "1.1.0",
  description:
    "選択したテキストをMarkdownファイルへローカル保存する、オフライン専用のクリッピング拡張です。",
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  options_page: "src/options/index.html",
  permissions: ["contextMenus", "storage", "notifications"],
  host_permissions: ["<all_urls>"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "Markdown WebClip",
    default_popup: "src/popup/index.html",
  },
  web_accessible_resources: [
    {
      matches: ["<all_urls>"],
      resources: ["src/picker/index.html", "src/category/index.html"],
    },
  ],
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
});
