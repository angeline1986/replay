#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(process.execPath, ['--experimental-strip-types', resolve(root, 'cli/main.ts')], {
  cwd: root, stdio: 'inherit', env: process.env
})
child.on('error', () => { console.error('Não foi possível iniciar o RePlay.'); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1) })
