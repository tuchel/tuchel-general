import { defineConfig } from "vite";

// Relative base works both on localhost dev/preview and under GitHub Pages subpaths.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096,
  },
});
