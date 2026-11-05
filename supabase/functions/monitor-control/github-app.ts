import { createPrivateKey, sign } from 'node:crypto'
import { Buffer } from 'node:buffer'

const api = 'https://api.github.com'
const repo = '/repos/angeline1986/replay'
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' }

export interface AppCredentials {
  appId: string
  installationId: string
  privateKey: string
}

export async function appJwt(credentials: AppCredentials, now = Date.now()): Promise<string> {
  if (!/^\d+$/.test(credentials.appId) || !/^\d+$/.test(credentials.installationId)) {
    throw new Error('Configuração do GitHub App inválida.')
  }
  const pem = credentials.privateKey.replace(/\\n/g, '\n')
  const payload = { iat: Math.floor(now / 1000) - 60,
    exp: Math.floor(now / 1000) + 540, iss: credentials.appId }
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part(payload)}`
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), createPrivateKey(pem))
  return `${unsigned}.${signature.toString('base64url')}`
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}.`)
  return await response.json() as T
}

export function githubClient(credentials: AppCredentials, fetcher: typeof fetch = fetch) {
  let token = ''
  async function installationToken(): Promise<string> {
    if (token) return token
    const jwt = await appJwt(credentials)
    const response = await fetcher(`${api}/app/installations/${credentials.installationId}/access_tokens`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { ...headers, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositories: ['replay'], permissions: { actions: 'write' } })
    })
    const data = await jsonResponse<{ token?: string }>(response)
    if (!data.token) throw new Error('GitHub não retornou token de instalação.')
    token = data.token
    return token
  }
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const credential = await installationToken()
    const response = await fetcher(`${api}${repo}${path}`, {
      ...init, signal: AbortSignal.timeout(10000),
      headers: { ...headers, Authorization: `Bearer ${credential}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
    })
    return jsonResponse<T>(response)
  }
  return {
    listRuns: () => request<{ workflow_runs: import('./status.ts').WorkflowRun[] }>(
      '/actions/workflows/monitor.yml/runs?branch=main&per_page=100'
    ),
    run: (id: number) => request<import('./status.ts').WorkflowRun>(`/actions/runs/${id}`),
    jobs: (id: number) => request<{ jobs: import('./status.ts').WorkflowJob[] }>(
      `/actions/runs/${id}/jobs?per_page=100`
    ),
    dispatch: () => request<{ workflow_run_id: number }>(
      '/actions/workflows/monitor.yml/dispatches', {
        method: 'POST', body: JSON.stringify({ ref: 'main', return_run_details: true })
      }
    ),
    async jobLog(jobId: number): Promise<string> {
      const credential = await installationToken()
      const response = await fetcher(`${api}${repo}/actions/jobs/${jobId}/logs`, {
        redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { ...headers, Authorization: `Bearer ${credential}` }
      })
      const location = response.headers.get('location')
      const download = response.status === 302 && location && new URL(location).protocol === 'https:'
        ? await fetcher(location, { signal: AbortSignal.timeout(10000) }) : response
      if (!download.ok || Number(download.headers.get('content-length') ?? 0) > 524288) {
        throw new Error('Resumo da coleta indisponível.')
      }
      const buffer = await download.arrayBuffer()
      if (buffer.byteLength > 524288) throw new Error('Resumo da coleta excedeu o limite.')
      return new TextDecoder().decode(buffer)
    }
  }
}

export type GithubClient = ReturnType<typeof githubClient>
