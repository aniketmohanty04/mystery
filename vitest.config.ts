import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 24 has globalThis.crypto (Web Crypto) natively — no jsdom needed
    // for these pure unit tests.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Ensure async tests fail on unhandled rejections.
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
