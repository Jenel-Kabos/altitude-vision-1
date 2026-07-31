import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./lib/__tests__/setup.js'],
    include: ['lib/__tests__/**/*.test.{js,jsx}'],
    // GL-DEBT-1 (Phase 15) : le testTimeout par défaut (5000ms) est
    // ponctuellement trop court pour des tests faisant un import() dynamique
    // de page dashboard sous forte contention CPU (voir setup.js pour le
    // même ajustement côté Testing Library). `maxThreads` est plafonné
    // pour réduire cette contention elle-même plutôt que la masquer
    // uniquement par des timeouts plus longs.
    testTimeout: 10000,
    poolOptions: {
      threads: { maxThreads: 8, minThreads: 2 },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
