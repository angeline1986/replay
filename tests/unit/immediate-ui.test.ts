import assert from 'node:assert/strict'
import test from 'node:test'
import { invokeInitialImport, type ImportInvoker } from '../../src/shared/import-channel.ts'

function fake(data: unknown, error: string | null = null): ImportInvoker & { calls: unknown[] } {
  const calls: unknown[] = []
  return { calls, functions: { invoke: async (name, options) => {
    calls.push({ name, options })
    return { data, error: error ? { message: error } : null }
  } } }
}

test('handle envia apenas handle para a Edge Function', async () => {
  const client = fake({ status: 'imported', channelId: 'uuid-1', importedVideos: 50 })
  const result = await invokeInitialImport(client, { handle: 'MestredoKimchi' })
  assert.equal(result.importedVideos, 50)
  assert.deepEqual(client.calls, [{ name: 'import-channel',
    options: { body: { handle: 'MestredoKimchi' } } }])
})

test('ID envia channelId, sem criar solicitacao pendente', async () => {
  const client = fake({ status: 'already_monitored', channelId: 'uuid-2', importedVideos: 0 })
  assert.equal((await invokeInitialImport(client, { id: 'UC' + 'a'.repeat(22) })).status,
    'already_monitored')
  assert.deepEqual(client.calls, [{ name: 'import-channel',
    options: { body: { channelId: 'UC' + 'a'.repeat(22) } } }])
})

test('falha remota interrompe sem indicar sucesso', async () => {
  await assert.rejects(invokeInitialImport(fake(null, 'Network down'), { handle: 'teste' }),
    /Importação indisponível/)
})

test('resposta malformada ou contagem excessiva e rejeitada', async () => {
  for (const data of [null, { status: 'imported', importedVideos: 51, channelId: 'x' },
    { status: 'done', importedVideos: 2, channelId: 'x' },
    { status: 'imported', importedVideos: 1, channelId: '' }]) {
    await assert.rejects(invokeInitialImport(fake(data), { handle: 'teste' }),
      /Resposta inválida/)
  }
})
