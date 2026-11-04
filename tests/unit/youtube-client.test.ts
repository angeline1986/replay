import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiBudget, QuotaError, youtubeGet } from '../../collector/youtube/client.ts'

test('limite local bloqueia chamada antes da rede', async () => {
  let calls = 0
  const fetcher = (async () => { calls++; return Response.json({ items: [] }) }) as typeof fetch
  const budget = new ApiBudget(1)
  await youtubeGet('channels', { part: 'contentDetails' }, 'test-key', budget, fetcher)
  await assert.rejects(youtubeGet('channels', { part: 'contentDetails' }, 'test-key', budget, fetcher),
    QuotaError)
  assert.equal(calls, 1)
  assert.equal(budget.used, 1)
})

test('erro de cota da API interrompe sem expor chave', async () => {
  const fetcher = (async () => Response.json({
    error: { errors: [{ reason: 'quotaExceeded' }] }
  }, { status: 403 })) as typeof fetch
  await assert.rejects(youtubeGet('channels', {}, 'secret-value', new ApiBudget(), fetcher),
    (error: unknown) => error instanceof QuotaError && !error.message.includes('secret-value'))
})

test('erros HTTP e JSON inválido são explícitos e não geram retry', async () => {
  let calls = 0
  const failed = (async () => { calls++; return new Response('', { status: 500 }) }) as typeof fetch
  await assert.rejects(youtubeGet('channels', {}, 'test-key', new ApiBudget(), failed), /HTTP 500/)
  assert.equal(calls, 1)
  const invalid = (async () => new Response('não é JSON')) as typeof fetch
  await assert.rejects(youtubeGet('channels', {}, 'test-key', new ApiBudget(), invalid), /JSON inválida/)
})
