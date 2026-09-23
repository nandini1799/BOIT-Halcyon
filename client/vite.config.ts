import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// vitest/config re-exports Vite's defineConfig with the `test` block typed, so
// one file configures both rather than two files drifting apart.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The API is same-origin in development, so the SSE stream is not a
    // cross-origin request and needs no CORS preflight on every question.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // Buffering here would defeat the point of streaming pipeline stages.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              delete proxyRes.headers['content-length'];
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Playwright owns the end-to-end suite; Vitest must not try to run it.
    exclude: ['e2e/**'],
  },
});
