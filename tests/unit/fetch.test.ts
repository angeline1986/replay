import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFeed } from '../../collector/feeds/fetch.ts'

const channelId = 'UC1234567890123456789012'
const xml = `<?xml version="1.0"?><feed><yt:channelId>${channelId}</yt:channelId></feed>`

test('feed indisponível com 404 falha sem apagar dados', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('', { status: 404 }) }
  try {
    await assert.rejects(fetchFeed(channelId), /HTTP 404/)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('falha transitória 500 recebe retry limitado', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return calls === 1 ? new Response('', { status: 500 }) : new Response(xml, { status: 200 })
  }
  try {
    assert.deepEqual((await fetchFeed(channelId)).videos, [])
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})

test('canal inválido é rejeitado antes da rede', async () => {
  await assert.rejects(fetchFeed('bad'), /ID de canal inválido/)
})
