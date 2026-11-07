import assert from 'node:assert/strict'
import test from 'node:test'
import { invokeAvatarRefresh, type AvatarRefreshClient } from '../../src/shared/channel-avatars.ts'

function fake(data: unknown, failed = false): AvatarRefreshClient & { calls: number } {
  let calls = 0
  return { get calls() { return calls }, functions: { invoke: async (name, options) => {
    calls++
    assert.equal(name, 'refresh-channel-avatars')
    assert.deepEqual(options, { body: {} })
    return { data, error: failed ? { message: 'falha' } : null }
  } } }
}

test('retorna quantidade de imagens atualizadas', async () => {
  const client = fake({ refreshed: 38, remaining: 0 })
  assert.equal(await invokeAvatarRefresh(client), 38)
  assert.equal(client.calls, 1)
})

test('falha ou resposta inválida não bloqueia carregamento do app', async () => {
  assert.equal(await invokeAvatarRefresh(fake(null, true)), 0)
  assert.equal(await invokeAvatarRefresh(fake({ refreshed: '38' })), 0)
})
