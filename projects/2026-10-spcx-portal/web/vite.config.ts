import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` inlines scripts, styles, and fonts into one HTML file for sharing.
// `--mode public` builds the public site, swapping client-licensed research for press-reported figures.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: mode === 'public' ? [{ find: /^\.\/licensed\.ts$/, replacement: decodeURIComponent(new URL('./src/licensed.public.ts', import.meta.url).pathname) }] : [],
  },
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 1e8 } : {},
}));
