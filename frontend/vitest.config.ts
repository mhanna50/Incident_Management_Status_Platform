import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    exclude: ['playwright/**', 'tests-playwright/**'],
    coverage: {
      reporter: ['text', 'html'],
      provider: 'v8',
      reportsDirectory: './coverage/unit',
    },
  },
})
