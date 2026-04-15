#!/usr/bin/env node
/** Strip pnpm's leading "--" before forwarding to the real CLI. */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const cli = path.join(__dirname, 'dist', 'cli', 'index.js')
let args = process.argv.slice(2)
if (args[0] === '--') args = args.slice(1)

const r = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' })
process.exit(r.status ?? 1)
