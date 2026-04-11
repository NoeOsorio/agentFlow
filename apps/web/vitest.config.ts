// @plan B3-PR-1 (updated in B1-PR-2 to support React component tests)
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    environmentMatchGlobs: [
      ['src/pages/__tests__/**/*.test.tsx', 'jsdom'],
      ['src/features/**/__tests__/**/*.test.tsx', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@agentflow/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@agentflow/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
})
