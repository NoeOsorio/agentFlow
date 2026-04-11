// @plan B3-PR-1
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
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
