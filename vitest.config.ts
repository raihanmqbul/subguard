import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: {
    // Disable PostCSS processing in tests to avoid config loading issues
    postcss: {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: false,
  },
  resolve: {
    alias: {
      '@': '/src',
      // Mock webextension-polyfill in tests — it requires a real browser extension context
      'webextension-polyfill': '/src/test/__mocks__/webextension-polyfill.ts',
    },
  },
});
