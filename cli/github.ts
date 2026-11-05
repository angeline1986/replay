import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { saoPauloDay } from '../scripts/daily-limit.ts'

const exec = promisify(execFile)
const repo = 'angeline1986/replay'
const workflow = 'monitor.yml'

export interface Run {
  databaseId: number
  event: string
  createdAt: string
  status: string
  conclusion: string | null
  url: string
}

async function gh(args: string[], maxBuffer = 1024 * 1024): Promise<string> {
  try {
    const { stdout } = await exec('gh', args, {
      timeout: 20000, maxBuffer, env: { ...process.env, GH_PROMPT_DISABLED: '1' }
    })
    return stdout.trim()
  } catch {
    throw new Error('GitHub CLI indisponível. Verifique gh auth status e a conexão.')
  }
}

export async function githubLogin(): Promise<string> {
  return gh(['api', 'user', '--jq', '.login'])
}

export async function listRuns(limit = 100): Promise<Run[]> {
  const output = await gh(['run', 'list', '--repo', repo, '--workflow', workflow,
    '--branch', 'main', '--limit', String(limit),
    '--json', 'databaseId,event,createdAt,status,conclusion,url'])
  let runs: Run[]
  try { runs = JSON.parse(output) as Run[] } catch { throw new Error('Histórico GitHub inválido.') }
  if (!Array.isArray(runs) || runs.some((run) => !Number.isSafeInteger(run.databaseId) ||
      !Number.isFinite(Date.parse(run.createdAt)) || typeof run.event !== 'string')) {
    throw new Error('Histórico GitHub inválido.')
  }
  return runs
}

export function manualAvailability(runs: Run[], now = new Date()): { allowed: boolean; reason: string } {
  const today = saoPauloDay(now.toISOString())
  if (runs.length >= 100 && saoPauloDay(runs.at(-1)!.createdAt) === today) {
    return { allowed: false, reason: 'Histórico do dia excede a verificação segura.' }
  }
  const sameDay = runs.filter((run) => saoPauloDay(run.createdAt) === today)
  if (sameDay.some((run) => run.event === 'workflow_dispatch')) {
    return { allowed: false, reason: 'A coleta manual do dia já foi solicitada.' }
  }
  if (sameDay.some((run) => run.status !== 'completed')) {
    return { allowed: false, reason: 'Há uma execução em andamento. Aguarde a conclusão.' }
  }
  return { allowed: true, reason: 'Janela manual disponível.' }
}

export async function dispatchManual(): Promise<void> {
  if ((await githubLogin()).toLowerCase() !== 'angeline1986') {
    throw new Error('Entre no gh com a conta angeline1986 antes de solicitar a coleta.')
  }
  const decision = manualAvailability(await listRuns())
  if (!decision.allowed) throw new Error(decision.reason)
  await gh(['workflow', 'run', workflow, '--ref', 'main', '--repo', repo])
}

interface Step { name: string; conclusion: string | null; status: string }
interface Detail { status: string; conclusion: string | null; startedAt: string | null;
  jobs: { startedAt?: string; steps?: Step[] }[] }

export function classifyRun(detail: Detail): string {
  const step = detail.jobs?.flatMap((job) => job.steps ?? [])
    .find((item) => item.name === 'Coletar vídeos públicos')
  if (detail.status !== 'completed') return detail.status === 'in_progress' ? 'executando' : 'aguardando'
  if (!step || step.conclusion === 'skipped') {
    return detail.conclusion === 'success' ? 'bloqueada (coleta não executada)' : 'falhou'
  }
  return step.conclusion === 'success' ? 'concluída' : 'falhou'
}

export function parseResult(log: string): string | null {
  return log.match(/Resultado: (?:sucesso|erro); gatilho=(?:schedule|workflow_dispatch); ativos=\d+; processados=\d+; vídeos=\d+; falhas=\d+; cota YouTube estimada=\d+ unidades\./)?.[0] ?? null
}

export async function runDetail(run: Run): Promise<{
  state: string; startedAt: string | null; summary: string | null; attempted: boolean
}> {
  const output = await gh(['run', 'view', String(run.databaseId), '--repo', repo,
    '--json', 'status,conclusion,startedAt,jobs'])
  let detail: Detail
  try { detail = JSON.parse(output) as Detail } catch { throw new Error('Detalhe GitHub inválido.') }
  const state = classifyRun(detail)
  const startedAt = detail.jobs?.[0]?.startedAt ?? detail.startedAt
  const attempted = Boolean(detail.jobs?.some((job) => job.steps?.some((step) =>
    step.name === 'Coletar vídeos públicos' && step.conclusion !== 'skipped')))
  if (state !== 'concluída' && state !== 'falhou') return { state, startedAt, summary: null, attempted }
  let summary: string | null = null
  if (attempted) try {
    const log = await gh(['run', 'view', String(run.databaseId), '--repo', repo, '--log'], 8 * 1024 * 1024)
    summary = parseResult(log)
  } catch { /* logs may not be available yet */ }
  return { state, startedAt, summary, attempted }
}
