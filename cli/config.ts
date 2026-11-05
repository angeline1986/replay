import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
const projectHost = 'fxbivwcfwqdvotohzrwg.supabase.co'

export async function publicConfig(): Promise<{ url: string; key: string }> {
  let content = ''
  try { content = await readFile(envPath, 'utf8') } catch { /* environment variables may be set */ }
  const values = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/)
    if (match) values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'))
  }
  const url = process.env.VITE_SUPABASE_URL ?? values.get('VITE_SUPABASE_URL') ?? ''
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? values.get('VITE_SUPABASE_PUBLISHABLE_KEY') ?? ''
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('Configure VITE_SUPABASE_URL em .env.local.') }
  if (parsed.protocol !== 'https:' || parsed.host !== projectHost || parsed.pathname !== '/' ||
      parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('A URL pública não corresponde ao projeto RePlay.')
  }
  if (!key.startsWith('sb_publishable_') || key.length > 1024) {
    throw new Error('Configure somente uma chave sb_publishable_ em .env.local.')
  }
  return { url: parsed.origin, key }
}
