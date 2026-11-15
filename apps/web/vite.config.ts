import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { brandAssets } from './vite-brand.ts';

/** The API in dev (apps/server, `pnpm dev`); production puts nginx in front of both. */
const API = 'http://127.0.0.1:5330';

export default defineConfig({
  plugins: [react(), brandAssets()],
  server: {
    port: 5331,
    strictPort: true,
    proxy: { '/api': API, '/auth': API, '/healthz': API },
  },
  preview: {
    port: 5331,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Art, audio and fonts stay as files: inlined they would grow the main chunk, and a strict CSP
    // (font-src 'self') refuses data: fonts.
    assetsInlineLimit: (file) => (/\/public\/(art|audio)\//.test(file) || /\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    sourcemap: true,
  },
});
