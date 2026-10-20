import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` inlines scripts, styles, and fonts into one HTML file for sharing.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 1e8 } : {},
}));
