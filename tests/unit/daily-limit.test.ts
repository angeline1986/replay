import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { decideDailySlot, loadWorkflowRuns, saoPauloDay, type WorkflowRun } from '../../scripts/daily-limit.ts'

const manual = (id: number, created_at: string): WorkflowRun =>
  ({ id, event: 'workflow_dispatch', created_at })
const scheduled = (id: number, created_at: string): WorkflowRun =>
  ({ id, event: 'schedule', created_at })
const now = '2026-11-04T20:05:00Z'

test('dia local de São Paulo troca às 03:00 UTC em novembro', () => {
  assert.equal(saoPauloDay('2026-11-04T02:59:59Z'), '2026-11-03')
  assert.equal(saoPauloDay('2026-11-04T03:00:00Z'), '2026-11-04')
})

test('primeira manual e automática ocupam duas vagas; segunda manual é negada', () => {
  const runs = [manual(1, '2026-11-04T12:00:00Z'),
    manual(2, '2026-11-04T13:00:00Z'), scheduled(3, '2026-11-04T20:00:00Z')]
  assert.equal(decideDailySlot(1, 'workflow_dispatch', now, runs).allowed, true)
  assert.match(decideDailySlot(2, 'workflow_dispatch', now, runs).reason, /já utilizada/)
  assert.equal(decideDailySlot(3, 'schedule', now, runs).allowed, true)
})

test('terceira coleta elegível no dia é negada', () => {
  const runs = [manual(1, '2026-11-04T11:00:00Z'),
    scheduled(2, '2026-11-04T12:00:00Z'), scheduled(3, '2026-11-04T20:00:00Z')]
  assert.match(decideDailySlot(3, 'schedule', now, runs).reason, /duas coletas/)
})

test('execução de outro dia, ausente ou evento indevido falha fechada', () => {
  const old = [manual(1, '2026-11-04T02:59:59Z')]
  assert.equal(decideDailySlot(1, 'workflow_dispatch', now, old).allowed, false)
  assert.equal(decideDailySlot(99, 'workflow_dispatch', now, old).allowed, false)
  assert.equal(decideDailySlot(1, 'push', now, old).allowed, false)
})

test('API usa token somente no cabeçalho e rejeita falha HTTP', async () => {
  let requested = ''
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requested = String(input)
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token')
    return Response.json({ workflow_runs: [manual(1, '2026-11-04T12:00:00Z')] })
  }) as typeof fetch
  const runs = await loadWorkflowRuns('owner/repo', 'test-token', '2026-11-04', fetcher)
  assert.equal(runs.length, 1)
  assert.equal(new URL(requested).searchParams.get('branch'), 'main')
  assert.equal(requested.includes('test-token'), false)
  const failed = (async () => new Response('', { status: 403 })) as typeof fetch
  await assert.rejects(loadWorkflowRuns('owner/repo', 'test-token', '2026-11-04', failed), /HTTP 403/)
})

test('paginação lê todo o dia e limita histórico excessivo', async () => {
  let calls = 0
  const fetcher = (async () => {
    calls++
    const items = Array.from({ length: 100 }, (_, i) =>
      manual(1000 - (calls - 1) * 100 - i, '2026-11-04T12:00:00Z'))
    return Response.json({ workflow_runs: items })
  }) as typeof fetch
  await assert.rejects(loadWorkflowRuns('owner/repo', 'test-token', '2026-11-04', fetcher),
    /limite seguro/)
  assert.equal(calls, 10)
})

test('workflow mantém dois gatilhos, limite e concorrência', () => {
  const yaml = readFileSync('.github/workflows/monitor.yml', 'utf8')
  assert.match(yaml, /cron: '0 17 \* \* \*'/)
  assert.match(yaml, /timezone: 'America\/Sao_Paulo'/)
  assert.match(yaml, /workflow_dispatch:/)
  assert.match(yaml, /group: replay-monitor-\$\{\{ github\.ref \}\}/)
  assert.match(yaml, /cancel-in-progress: false/)
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/)
  assert.match(yaml, /steps\.daily_gate\.outputs\.allowed == 'true'/)
  assert.doesNotMatch(yaml, /17 9,21 \* \* \*/)
})
