import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // relative base so assets resolve under any mount point — works at / and behind an
  // EDA HttpProxy sub-path, mirroring the cable-map deployment.
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174 },
})
