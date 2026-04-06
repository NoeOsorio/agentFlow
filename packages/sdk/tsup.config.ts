import { defineConfig } from 'tsup'
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
  },
  {
    entry: ['src/cli/index.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    banner: { js: '#!/usr/bin/env node' },
  },
])
