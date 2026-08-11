import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The browser only ever talks to :5173. This reproduces the production
      // topology (Caddy routing /api to the API container) so cookies, URLs and
      // the absence of CORS are identical in dev and prod. See README.
      '/api': { target: 'http://localhost:3000' },
    },
  },
});
