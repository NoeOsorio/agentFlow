// @plan B2-PR-1
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.tsx', 'src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@agentflow/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
})
