import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // relative base so assets resolve under any mount point — works at / and under any
  // reverse-proxy sub-path.
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174 },
})
