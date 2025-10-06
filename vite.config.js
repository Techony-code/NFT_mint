import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      util: 'util',
      stream: 'stream-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      process: 'process/browser',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'util', 'stream-browserify', 'stream-http', 'https-browserify', 'process'],
  },
})