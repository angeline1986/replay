import assert from 'node:assert/strict'
import test from 'node:test'
import { channelRoute, routeFromHash } from '../../src/app/route.ts'

const id = '12345678-1234-1234-1234-123456789abc'

test('rota hash abre vídeos e canais, inclusive após atualização', () => {
  assert.deepEqual(routeFromHash('#videos'), { page: 'videos', channelId: '' })
  assert.deepEqual(routeFromHash('#channels'), { page: 'channels', channelId: '' })
  assert.deepEqual(routeFromHash(channelRoute(id)), { page: 'videos', channelId: id })
})

test('rota de canal rejeita ID inválido', () => {
  assert.throws(() => channelRoute('javascript:alert(1)'), /inválido/)
  assert.deepEqual(routeFromHash('#videos/bad'), { page: 'videos', channelId: '' })
})
