import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/**/*.integration.test.js'],
    fileParallelism: true,
    testTimeout: 10000,
    reporter: 'verbose',
  },
});