import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage'])
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{15,}/,
  /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}/i,
  /ghp_[A-Za-z0-9]{30,}/
]
const failures = []

async function scan(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (entry.name === 'package-lock.json') continue
    const content = await readFile(path, 'utf8')
    if (patterns.some((pattern) => pattern.test(content))) failures.push(path)
  }
}

await scan()
if (failures.length) {
  console.error(`Possíveis segredos: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('Nenhum padrão de segredo encontrado nos arquivos mantidos.')
}
