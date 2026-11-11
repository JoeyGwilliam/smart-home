import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

// Identifies this build, so that an open page can tell when a newer one has been deployed (see src/deploy/useReloadOnNewBuild.ts).
const BUILD_ID = new Date().toISOString()

/** Publishes the build ID at /build-id.json, alongside the app, for open pages to compare against their own. */
function publishBuildId(): Plugin {
  return {
    name: 'publish-build-id',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-id.json', source: JSON.stringify({ buildId: BUILD_ID }) })
    },
  }
}

// The app calls the APIs under /api, on its own origin, so they need no CORS setup and can stay private: the timers API
// under /api/timers, and the reminders API under everything else. In development this proxy forwards those calls; in
// production nginx.conf does the same job.
export default defineConfig({
  plugins: [react(), tailwindcss(), publishBuildId()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      // Vite uses the first entry that matches, so the longer prefix has to come first.
      '/api/timers': {
        target: 'http://localhost:8001',
        rewrite: (path) => path.replace(/^\/api\/timers/, ''),
      },
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
