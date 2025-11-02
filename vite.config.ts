import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.config.ts";

// https://vite.dev/config/
export default defineConfig({
  base: "",
  plugins: [react(), crx({ manifest }), tailwindcss()],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    outDir: "dist",
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      input: {
        options: resolve(__dirname, "src/options/index.html"),
        picker: resolve(__dirname, "src/picker/index.html"),
        popup: resolve(__dirname, "src/popup/index.html"),
      },
    },
  },
});
