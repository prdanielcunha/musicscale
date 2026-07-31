import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      'functions/tests/**',
      'utils/songDiscovery/tests/**',
      '**/tests/e2e/**',
    ],
  },
});
