import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🔒 Never expose source maps in production
    sourcemap: false,
  },
  esbuild: {
    // 🔒 Strip all console.log/warn/error and debugger statements from production builds
    // This prevents information leakage through browser DevTools
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})
