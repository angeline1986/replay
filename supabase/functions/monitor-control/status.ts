export type CollectionState = 'aguardando' | 'executando' | 'concluída' | 'bloqueada' | 'falhou'

export interface WorkflowRun {
  id: number
  event: string
  status: string
  conclusion: string | null
  created_at: string
  run_started_at?: string | null
  updated_at?: string | null
  head_branch?: string | null
  path?: string
}

export interface WorkflowStep {
  name: string
  number: number
  status: string
  conclusion: string | null
}

export interface WorkflowJob {
  id: number
  started_at?: string | null
  completed_at?: string | null
  steps?: WorkflowStep[]
}

export interface CollectionStatus {
  id: number
  state: CollectionState
  trigger: 'automática' | 'manual'
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  videosProcessed: number | null
  failures: number | null
  quotaUnits: number | null
  errors: string[]
}

const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit' })

export function saoPauloDay(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Data de execução inválida.')
  const parts = Object.fromEntries(localDay.formatToParts(date)
    .map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function manualWindow(runs: WorkflowRun[], now: string): { allowed: boolean; reason: string } {
  const today = saoPauloDay(now)
  if (runs.length >= 100 && saoPauloDay(runs.at(-1)!.created_at) === today) {
    return { allowed: false, reason: 'Histórico do dia excedeu o limite de consulta.' }
  }
  const todayRuns = runs.filter((run) => saoPauloDay(run.created_at) === today)
  if (todayRuns.some((run) => run.event === 'workflow_dispatch')) {
    return { allowed: false, reason: 'Coleta manual do dia já solicitada.' }
  }
  if (todayRuns.filter((run) => run.event === 'schedule').length >= 2) {
    return { allowed: false, reason: 'Limite de duas coletas no dia atingido.' }
  }
  if (runs.some((run) => run.status !== 'completed' &&
    (run.event === 'schedule' || run.event === 'workflow_dispatch'))) {
    return { allowed: false, reason: 'Já existe coleta aguardando ou em execução.' }
  }
  return { allowed: true, reason: 'Coleta manual disponível.' }
}

export function parseCollectorLog(log: string): Pick<CollectionStatus,
  'videosProcessed' | 'failures' | 'quotaUnits' | 'errors'> {
  const summary = [...log.matchAll(/Resultado: (?:sucesso|erro);[^\n]*?vídeos=(\d+); falhas=(\d+); cota YouTube estimada=(\d+) unidades\./g)].at(-1)
  const errors = log.split('\n').map((line) => line.match(
    /(?:Canal [a-f0-9-]{36}|Falha na coleta|Falha em handles|Falha antes da coleta):[^\n]*/)?.[0]
  ).filter((line): line is string => Boolean(line))
    .slice(0, 5).map((line) => line.replace(/https?:\/\/\S+/g, '[URL]')
      .replace(/(?:github_pat_|sb_secret_|gh[pousr]_|AIza)[^\s;]*/g, '[SECRET]')
      .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 180))
  return { videosProcessed: summary ? Number(summary[1]) : null,
    failures: summary ? Number(summary[2]) : null,
    quotaUnits: summary ? Number(summary[3]) : null, errors }
}

export function projectStatus(run: WorkflowRun, jobs: WorkflowJob[],
  log = ''): CollectionStatus {
  const steps = jobs.flatMap((job) => job.steps ?? [])
  const collected = steps.find((step) => step.name === 'Coletar vídeos públicos')
  const blocked = steps.some((step) => step.name === 'Coleta bloqueada pelo limite diário' &&
    step.conclusion === 'success')
  let state: CollectionState = 'aguardando'
  if (run.status === 'in_progress') state = 'executando'
  else if (run.status === 'completed') {
    state = blocked || run.conclusion === 'skipped' ? 'bloqueada'
      : run.conclusion === 'success' && collected?.conclusion === 'success'
        ? 'concluída' : 'falhou'
  }
  const summary = collected?.conclusion && collected.conclusion !== 'skipped'
    ? parseCollectorLog(log) : { videosProcessed: null, failures: null, quotaUnits: null, errors: [] }
  if (state === 'falhou' && !summary.errors.length) {
    const failed = steps.find((step) => step.conclusion === 'failure')
    if (failed) summary.errors.push(`Falha na etapa: ${failed.name}.`)
  }
  return { id: run.id, state,
    trigger: run.event === 'schedule' ? 'automática' : 'manual',
    scheduledAt: run.event === 'schedule' ? '17:00 America/Sao_Paulo' : null,
    startedAt: jobs[0]?.started_at ?? run.run_started_at ?? null,
    finishedAt: run.status === 'completed' ? jobs[0]?.completed_at ?? run.updated_at ?? null : null,
    ...summary }
}
