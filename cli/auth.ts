import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { publicConfig } from './config.ts'

const open = promisify(execFile)
const callback = 'http://localhost:5173/replay/'

export function callbackRequest(host: string | undefined, method: string | undefined, target: string):
  { valid: boolean; code: string | null; denied: boolean } {
  const url = new URL(target, callback)
  const valid = host === 'localhost:5173' && method === 'GET' && url.pathname === '/replay/'
  const code = url.searchParams.get('code')
  return { valid, code: code && code.length <= 4096 ? code : null,
    denied: url.searchParams.has('error') }
}

export function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value) },
    removeItem: (key: string) => { items.delete(key) }
  }
}

export async function makeAuthClient(): Promise<SupabaseClient> {
  const { url, key } = await publicConfig()
  return createClient(url, key, { auth: {
    flowType: 'pkce', storage: memoryStorage(), persistSession: true,
    autoRefreshToken: false, detectSessionInUrl: false
  } })
}

export async function browserSignIn(
  client: SupabaseClient, launch: (url: string) => Promise<unknown> = (url) => open('open', [url])
): Promise<void> {
  let resolveCode!: (value: string) => void
  let rejectCode!: (error: Error) => void
  const received = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject })
  const server = createServer((request, response) => {
    const parsed = callbackRequest(request.headers.host, request.method, request.url ?? '/')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
    if (!parsed.valid) {
      response.writeHead(404).end('Página não encontrada.')
      return
    }
    if (parsed.denied) {
      response.writeHead(400).end('Login não concluído. Volte ao Terminal.')
      rejectCode(new Error('Login GitHub cancelado ou recusado.'))
      return
    }
    if (!parsed.code) {
      response.writeHead(400).end('Código de login inválido.')
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<!doctype html><title>RePlay</title><p>Login recebido. Volte ao Terminal.</p>')
    resolveCode(parsed.code)
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(5173, 'localhost', resolve)
    })
  } catch {
    throw new Error('Porta 5173 ocupada. Feche o servidor local do RePlay e tente novamente.')
  }
  const timer = setTimeout(() => rejectCode(new Error('Tempo de login esgotado.')), 120000)
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'github', options: { redirectTo: callback, skipBrowserRedirect: true }
    })
    if (error || !data.url) throw new Error('Não foi possível iniciar o login GitHub.')
    try { await launch(data.url) }
    catch { throw new Error('Não foi possível abrir o navegador para o login.') }
    const code = await received
    const exchanged = await client.auth.exchangeCodeForSession(code)
    if (exchanged.error || !exchanged.data.session) throw new Error('Sessão GitHub não confirmada.')
  } finally {
    clearTimeout(timer)
    server.close()
  }
}

export async function requireOwner(client: SupabaseClient): Promise<string> {
  const session = await client.auth.getSession()
  if (session.error || !session.data.session) await browserSignIn(client)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Sessão Supabase inválida. Entre novamente.')
  const profile = await client.from('profiles').select('user_id,role')
    .eq('user_id', data.user.id).maybeSingle()
  if (profile.error || profile.data?.role !== 'owner' || profile.data.user_id !== data.user.id) {
    throw new Error('Acesso restrito ao perfil owner do RePlay.')
  }
  return data.user.id
}
