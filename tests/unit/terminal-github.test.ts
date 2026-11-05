import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyRun, manualAvailability, parseResult, type Run } from '../../cli/github.ts'

const now = new Date('2026-11-04T20:15:00Z')
function run(event: string, createdAt: string, status = 'completed'): Run {
  return { databaseId: 1, event, createdAt, status, conclusion: 'success', url: 'https://github.com/' }
}

test('terminal oferece uma vaga manual apesar da automática concluída', () => {
  assert.equal(manualAvailability([run('schedule', '2026-11-04T20:00:00Z')], now).allowed, true)
})

test('terminal bloqueia segunda manual no mesmo dia de São Paulo', () => {
  const prior = run('workflow_dispatch', '2026-11-04T03:00:00Z')
  assert.equal(manualAvailability([prior], now).allowed, false)
  assert.equal(manualAvailability([run('workflow_dispatch', '2026-11-04T02:59:00Z')], now).allowed, true)
})

test('terminal bloqueia execução simultânea e histórico insuficiente', () => {
  assert.equal(manualAvailability([run('schedule', '2026-11-04T20:00:00Z', 'in_progress')], now).allowed, false)
  const many = Array.from({ length: 100 }, (_, index) => ({
    ...run('schedule', '2026-11-04T20:00:00Z'), databaseId: index + 1
  }))
  assert.equal(manualAvailability(many, now).allowed, false)
})

test('workflow verde sem etapa de coleta não vira coleta concluída', () => {
  const base = { status: 'completed', conclusion: 'success', startedAt: null, jobs: [
    { steps: [{ name: 'Coletar vídeos públicos', conclusion: 'skipped', status: 'completed' }] }
  ] }
  assert.match(classifyRun(base), /bloqueada/)
  assert.equal(classifyRun({ ...base, conclusion: 'failure' }), 'falhou')
  assert.equal(classifyRun({ ...base, jobs: [{ steps: [
    { name: 'Coletar vídeos públicos', conclusion: 'success', status: 'completed' }
  ] }] }), 'concluída')
})

test('resumo de coleta aceita apenas campos numéricos esperados', () => {
  const line = 'Resultado: sucesso; gatilho=schedule; ativos=2; processados=2; vídeos=100; falhas=0; cota YouTube estimada=6 unidades.'
  assert.equal(parseResult(`token privado\n${line}\n`), line)
  assert.equal(parseResult('Resultado: sucesso; token=privado'), null)
})
