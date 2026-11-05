import type { GithubClient } from './github-app.ts'
import { manualWindow, projectStatus, type WorkflowRun } from './status.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export interface OwnerSession {
  userId: string
  activeCount(): Promise<number>
  changeChannels(active: boolean, channelId: string | null, expectedCount: number | null): Promise<number>
}

export interface Services {
  owner(authorization: string): Promise<OwnerSession>
  github(): GithubClient
  now(): string
}

const origins = new Set(['https://angeline1986.github.io', 'http://localhost:5173'])

function response(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'Cache-Control': 'no-store', Vary: 'Origin' }
  if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return new Response(JSON.stringify(body), { status, headers })
}

function validRuns(value: unknown): WorkflowRun[] {
  if (!Array.isArray(value) || value.some((run) => !Number.isSafeInteger(run.id) ||
    typeof run.created_at !== 'string' || typeof run.event !== 'string' ||
    typeof run.status !== 'string')) throw new Error('Histórico GitHub inválido.')
  let previous = Infinity
  for (const run of value) {
    const created = Date.parse(run.created_at)
    if (!Number.isFinite(created) || created > previous) throw new Error('Ordem GitHub inválida.')
    previous = created
  }
  return value as WorkflowRun[]
}

export async function handleMonitorRequest(req: Request, services: Services): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && !origins.has(origin)) return response({ error: 'Origem não autorizada.' }, 403, origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin ?? '',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin'
    } })
  }
  if (req.method !== 'POST') return response({ error: 'Método não permitido.' }, 405, origin)
  try {
    const bearer = req.headers.get('authorization') ?? ''
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer)) {
      throw new HttpError(401, 'Sessão ausente ou inválida.')
    }
    const owner = await services.owner(bearer)
    const raw = await req.text()
    if (raw.length > 4096) throw new HttpError(413, 'Pedido muito grande.')
    let input: Record<string, unknown>
    try { input = JSON.parse(raw) as Record<string, unknown> }
    catch { throw new HttpError(400, 'JSON inválido.') }
    if (!input || typeof input !== 'object') throw new HttpError(400, 'Pedido inválido.')
    if (input.action === 'channels') {
      if (typeof input.active !== 'boolean') throw new HttpError(400, 'Estado inválido.')
      const channelId = typeof input.channelId === 'string' ? input.channelId : null
      if (input.channelId != null && !/^[a-f0-9-]{36}$/i.test(channelId!)) {
        throw new HttpError(400, 'Canal inválido.')
      }
      const count = input.expectedCount
      if (channelId === null && (!Number.isSafeInteger(count) || (count as number) < 0 ||
        (count as number) > 1000)) throw new HttpError(400, 'Contagem inválida.')
      const changed = await owner.changeChannels(input.active, channelId,
        channelId ? null : count as number)
      return response({ changed }, 200, origin)
    }
    if (input.action !== 'status' && input.action !== 'dispatch') {
      throw new HttpError(400, 'Ação inválida.')
    }
    const github = services.github()
    const data = await github.listRuns()
    const runs = validRuns(data.workflow_runs)
    const active = await owner.activeCount()
    const window = manualWindow(runs, services.now())
    const reason = active ? window.reason : 'Ative ao menos um canal antes de atualizar vídeos.'
    if (input.action === 'dispatch') {
      if (!active || !window.allowed) {
        return response({ state: 'bloqueada', reason }, 409, origin)
      }
      const result = await github.dispatch()
      if (!Number.isSafeInteger(result.workflow_run_id)) {
        throw new Error('GitHub não retornou ID da execução.')
      }
      return response({ state: 'aguardando', runId: result.workflow_run_id }, 202, origin)
    }
    const runId = input.runId
    if (runId != null && (!Number.isSafeInteger(runId) || (runId as number) < 1)) {
      throw new HttpError(400, 'ID de execução inválido.')
    }
    const run = runId ? await github.run(runId as number) : runs[0]
    if (run && (run.head_branch !== 'main' ||
      (run.path && run.path !== '.github/workflows/monitor.yml'))) {
      throw new HttpError(404, 'Execução não encontrada.')
    }
    const jobs = run ? (await github.jobs(run.id)).jobs : []
    if (!Array.isArray(jobs)) throw new Error('Jobs GitHub inválidos.')
    const collector = jobs.flatMap((job) => job.steps ?? [])
      .find((step) => step.name === 'Coletar vídeos públicos' && step.conclusion &&
        step.conclusion !== 'skipped')
    let log = ''
    if (collector) {
      const job = jobs.find((item) => item.steps?.includes(collector))
      try { if (job) log = await github.jobLog(job.id) }
      catch { /* Status permanece disponível sem detalhes do log. */ }
    }
    return response({ run: run ? projectStatus(run, jobs, log) : null,
      manualAvailable: active > 0 && window.allowed, manualReason: reason,
      activeChannels: active }, 200, origin)
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message }, error.status, origin)
    return response({ error: 'Não foi possível consultar o monitoramento.' }, 502, origin)
  }
}
