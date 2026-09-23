import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['node_modules', '.kilo/**', 'e2e/**/*', 'extensions/**/*.test.mjs'],
  },
});
