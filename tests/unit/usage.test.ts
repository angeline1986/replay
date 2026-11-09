import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { summarizeUsage } from '../../src/features/usage/data.ts'
import { usageView } from '../../src/features/usage/view.ts'
import { routeFromHash } from '../../src/app/route.ts'

test('consumo usa o dia da cota no Pacífico e separa coleta de cadastros', () => {
  const summary = summarizeUsage([
    { started_at: '2026-11-08T07:59:00Z', status: 'success', item_count: 100 },
    { started_at: '2026-11-08T08:01:00Z', status: 'success', item_count: 75 },
    { started_at: '2026-11-08T08:02:00Z', status: 'success', item_count: 7 }
  ], [
    { created_at: '2026-11-08T08:03:00Z', status: 'done' },
    { created_at: '2026-11-08T07:58:00Z', status: 'done' }
  ], new Date('2026-11-08T08:05:00Z'))
  assert.deepEqual(summary, { day: '2026-11-08', lower: 5, upper: 7,
    channels: 2, attempts: 1, lastCheck: '2026-11-08T08:02:00Z' })
})

test('dia sem coleta mostra zero e preserva a data da última coleta registrada', () => {
  const summary = summarizeUsage([
    { started_at: '2026-11-08T23:24:00Z', status: 'success', item_count: 41 }
  ], [], new Date('2026-11-09T17:15:00Z'))
  assert.equal(summary.day, '2026-11-09')
  assert.equal(summary.lower, 0)
  assert.equal(summary.upper, 0)
  assert.equal(summary.channels, 0)
  assert.equal(summary.lastCheck, '2026-11-08T23:24:00Z')
})

test('página mostra estimativa identificável e link para o total oficial', async () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const view = usageView(async () => ({ day: '2026-11-08', lower: 71, upper: 85,
      channels: 41, attempts: 1, lastCheck: '2026-11-08T23:24:00Z' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(routeFromHash('#usage').page, 'usage')
    assert.match(view.textContent ?? '', /71–85/)
    assert.match(view.textContent ?? '', /41/)
    assert.match(view.textContent ?? '', /10\.000/)
    assert.match(view.textContent ?? '', /total exato fica no Google Cloud/)
    assert.equal(view.querySelector('progress')?.getAttribute('value'), '85')
    assert.equal(view.querySelector<HTMLAnchorElement>('.usage-cloud')?.hostname, 'console.cloud.google.com')
  } finally { globalThis.document = original; dom.window.close() }
})
