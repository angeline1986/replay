export interface WorkflowRun {
  id: number
  event: string
  created_at: string
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
})

export function saoPauloDay(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Data de execução inválida.')
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function decideDailySlot(
  currentId: number, event: string, now: string, runs: WorkflowRun[]
): { allowed: boolean; reason: string } {
  if (event !== 'schedule' && event !== 'workflow_dispatch') {
    return { allowed: false, reason: 'Evento não autorizado.' }
  }
  const today = saoPauloDay(now)
  const current = runs.find((run) => run.id === currentId)
  if (!current || current.event !== event) {
    return { allowed: false, reason: 'Execução atual não encontrada no histórico.' }
  }
  if (saoPauloDay(current.created_at) !== today) {
    return { allowed: false, reason: 'Execução criada em outro dia local.' }
  }
  const todayRuns = runs.filter((run) => saoPauloDay(run.created_at) === today)
  const compare = (a: WorkflowRun, b: WorkflowRun) =>
    Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id
  const firstManual = todayRuns.filter((run) => run.event === 'workflow_dispatch').sort(compare)[0]
  if (event === 'workflow_dispatch' && firstManual?.id !== currentId) {
    return { allowed: false, reason: 'Coleta manual do dia já utilizada.' }
  }
  const eligible = todayRuns.filter((run) =>
    run.event === 'schedule' || run.id === firstManual?.id
  ).sort(compare)
  if (eligible.findIndex((run) => run.id === currentId) >= 2) {
    return { allowed: false, reason: 'Limite de duas coletas no dia atingido.' }
  }
  return { allowed: true, reason: 'Janela diária disponível.' }
}

export async function loadWorkflowRuns(
  repository: string, token: string, today: string, fetcher: typeof fetch = fetch
): Promise<WorkflowRun[]> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
    throw new Error('Contexto GitHub Actions incompleto.')
  }
  const runs: WorkflowRun[] = []
  let previous = Infinity
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`https://api.github.com/repos/${repository}/actions/workflows/monitor.yml/runs`)
    url.searchParams.set('branch', 'main')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28' }
    })
    if (!response.ok) throw new Error(`GitHub Actions API HTTP ${response.status}.`)
    const body = await response.json() as { workflow_runs?: WorkflowRun[] }
    if (!Array.isArray(body.workflow_runs)) throw new Error('Histórico GitHub inválido.')
    for (const run of body.workflow_runs) {
      if (!Number.isSafeInteger(run.id) || typeof run.event !== 'string') {
        throw new Error('Execução GitHub inválida.')
      }
      const created = Date.parse(run.created_at)
      if (!Number.isFinite(created) || created > previous) {
        throw new Error('Ordem do histórico GitHub inválida.')
      }
      previous = created
      runs.push(run)
    }
    if (body.workflow_runs.length < 100 || saoPauloDay(body.workflow_runs.at(-1)!.created_at) < today) {
      return runs
    }
  }
  throw new Error('Histórico GitHub excedeu limite seguro de paginação.')
}
