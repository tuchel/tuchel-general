import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://tuchel.github.io/tuchel-general/metro-budget-tax/
export default defineConfig({
  plugins: [react()],
  base: '/tuchel-general/metro-budget-tax/',
})
