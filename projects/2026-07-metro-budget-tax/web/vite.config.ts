import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://tuchel.github.io/tuchel-general/tax/
export default defineConfig({
  plugins: [react()],
  base: '/tuchel-general/tax/',
})
