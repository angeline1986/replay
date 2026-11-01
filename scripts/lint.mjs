import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage'])
const source = new Set(['.ts', '.js', '.mjs', '.css', '.html', '.sql', '.yml', '.yaml'])
const problems = []

async function scan(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) { await scan(path); continue }
    if (!source.has(entry.name.slice(entry.name.lastIndexOf('.')))) continue
    const lines = (await readFile(path, 'utf8')).split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      if (/[ \t]+$/.test(line) || line.includes('\r') || /^(<{7}|={7}|>{7})/.test(line)) {
        problems.push(`${path}:${index + 1}`)
      }
    }
  }
}

await scan()
if (problems.length) {
  console.error(`Problemas de formatação ou conflito: ${problems.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('Lint básico: sem espaços finais, CRLF ou marcadores de conflito.')
}
