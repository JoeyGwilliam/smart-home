import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The app calls the reminders API under /api, on its own origin, so the API needs no CORS setup and can stay private.
// In development this proxy forwards those calls; in production nginx.conf does the same job.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Due times are shown in the viewer's local time zone, so tests pin one to give the same results on every machine.
    env: { TZ: 'Europe/London' },
  },
})
