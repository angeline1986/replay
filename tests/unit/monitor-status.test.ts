import assert from 'node:assert/strict'
import test from 'node:test'
import { manualWindow, parseCollectorLog, projectStatus, saoPauloDay,
  type WorkflowJob, type WorkflowRun } from '../../supabase/functions/monitor-control/status.ts'

const now = '2026-11-05T15:00:00Z'
const run = (id: number, event: string, created_at = now): WorkflowRun => ({
  id, event, created_at, status: 'completed', conclusion: 'success',
  head_branch: 'main', path: '.github/workflows/monitor.yml'
})
const job = (steps: WorkflowJob['steps']): WorkflowJob => ({ id: 3,
  started_at: '2026-11-05T00:41:36Z', completed_at: '2026-11-05T00:41:54Z', steps })

test('dia local de São Paulo e horário programado diferem do início efetivo', () => {
  assert.equal(saoPauloDay('2026-11-05T00:41:32Z'), '2026-11-04')
  const status = projectStatus(run(1, 'schedule'), [job([
    { name: 'Coletar vídeos públicos', number: 5, status: 'completed', conclusion: 'success' }
  ])], 'Resultado: sucesso; gatilho=schedule; ativos=2; processados=2; vídeos=100; falhas=0; cota YouTube estimada=5 unidades.')
  assert.equal(status.state, 'concluída')
  assert.equal(status.scheduledAt, '17:00 America/Sao_Paulo')
  assert.equal(status.startedAt, '2026-11-05T00:41:36Z')
  assert.equal(status.videosProcessed, 100)
  assert.equal(status.quotaUnits, 5)
  const withoutLog = projectStatus(run(2, 'schedule'), [job([
    { name: 'Coletar vídeos públicos', number: 5, status: 'completed', conclusion: 'success' }
  ])])
  assert.equal(withoutLog.state, 'concluída')
  assert.equal(withoutLog.videosProcessed, null)
})

test('workflow concluído sem etapa de coleta é bloqueado, não concluído', () => {
  const status = projectStatus(run(1, 'workflow_dispatch'), [job([
    { name: 'Coleta bloqueada pelo limite diário', number: 4,
      status: 'completed', conclusion: 'success' }
  ])])
  assert.equal(status.state, 'bloqueada')
  assert.equal(status.videosProcessed, null)
  assert.equal(status.scheduledAt, null)
  assert.equal(projectStatus(run(2, 'schedule'), [job([])]).state, 'falhou')
})

test('estados aguardando, executando e falhou preservam ausência de contagem', () => {
  assert.equal(projectStatus({ ...run(1, 'schedule'), status: 'queued' }, []).state, 'aguardando')
  assert.equal(projectStatus({ ...run(1, 'schedule'), status: 'in_progress' }, []).state, 'executando')
  const failed = projectStatus({ ...run(1, 'schedule'), conclusion: 'failure' }, [job([
    { name: 'Coletar vídeos públicos', number: 5, status: 'completed', conclusion: 'failure' }
  ])])
  assert.equal(failed.state, 'falhou')
  assert.equal(failed.videosProcessed, null)
  assert.match(failed.errors[0], /Coletar vídeos públicos/)
})

test('resumo lê somente campos permitidos e reduz erros', () => {
  const data = parseCollectorLog('collect\tColetar vídeos públicos\t2026-11-05T00:41:51Z Canal 00000000-0000-0000-0000-000000000000: HTTP 403\n' +
    'Resultado: erro; gatilho=schedule; ativos=2; processados=1; vídeos=12; falhas=1; cota YouTube estimada=3 unidades.')
  assert.equal(data.videosProcessed, 12)
  assert.equal(data.failures, 1)
  assert.equal(data.errors.length, 1)
  assert.equal(parseCollectorLog('sem resumo').videosProcessed, null)
  const secret = 'sb_secret_' + 'x'.repeat(20)
  const redacted = parseCollectorLog(`Canal 00000000-0000-0000-0000-000000000000: ${secret}`)
  assert.equal(redacted.errors[0].includes(secret), false)
})

test('janela manual nega segunda solicitação e execução simultânea', () => {
  assert.equal(manualWindow([], now).allowed, true)
  assert.match(manualWindow([run(1, 'workflow_dispatch')], now).reason, /já solicitada/)
  assert.equal(manualWindow([{ ...run(1, 'schedule'), status: 'in_progress' }], now).allowed, false)
  assert.equal(manualWindow([run(1, 'schedule')], now).allowed, true)
  assert.equal(manualWindow([run(1, 'schedule'), run(2, 'schedule')], now).allowed, false)
  assert.equal(manualWindow([run(1, 'workflow_dispatch', '2026-11-05T02:00:00Z')], now).allowed, true)
  assert.equal(manualWindow(Array.from({ length: 100 }, (_, id) => run(id + 1, 'schedule')), now).allowed, false)
})
