// @plan B3-PR-1
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@agentflow/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@agentflow/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
})
