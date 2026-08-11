import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entries: runtime schemas/helpers, and the generated OpenAPI types which are
  // type-only and consumed exclusively by the web app.
  entry: ['src/index.ts', 'src/api-types.ts'],
  // Both formats: the API is CommonJS (NestJS), the web app is ESM (Vite).
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2023',
});
