import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one Postgres database, so they must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  // esbuild (vitest's default transform) does not emit `emitDecoratorMetadata`,
  // which NestJS needs to resolve constructor injection. SWC does.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
