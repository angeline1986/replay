import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage'])
const generated = new Set(['package-lock.json'])
const codeExtensions = new Set([
  '.html', '.css', '.ts', '.js', '.mjs', '.sql', '.yml', '.yaml', '.json', '.toml'
])
const configNames = new Set(['.gitignore', '.env.example'])
const failures = []

async function scan(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (generated.has(entry.name)) continue
    const extension = entry.name.slice(entry.name.lastIndexOf('.'))
    if (!codeExtensions.has(extension) && !configNames.has(entry.name)) continue
    const content = await readFile(path, 'utf8')
    const lines = content.trimEnd().split('\n').length
    if (lines > 200) failures.push(`${path}: ${lines} linhas`)
  }
}

await scan()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Arquivos de código e configuração: máximo de 200 linhas respeitado.')
}
