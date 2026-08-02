import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': process.env.VITE_API_TARGET || 'http://127.0.0.1:4174' } },
  preview: { proxy: { '/api': process.env.VITE_API_TARGET || 'http://127.0.0.1:4174' } }
})
