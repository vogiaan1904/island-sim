import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// pnpm client runs this dev server with hot reload. It reaches the real game server (pnpm server:dev) through a proxy,
// so the page, /api and /ws share one origin, as they do when the server serves the build.
const gameServer = process.env.ISLAND_SERVER_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: gameServer },
      // ws: true forwards the upgrade. The Origin header stays the dev server's own: ISLAND_ORIGIN must match it.
      '/ws': { target: gameServer, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
