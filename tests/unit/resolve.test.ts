import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHandle } from '../../collector/youtube/resolve.ts'

test('resolve handle pela API e valida ID retornado', async () => {
  const original = globalThis.fetch
  let called = ''
  globalThis.fetch = async (url) => {
    called = String(url)
    return Response.json({ items: [{
      id: 'UC1234567890123456789012',
      snippet: { title: 'Canal', thumbnails: { default: { url: 'https://example.com/avatar.jpg' } } }
    }] })
  }
  try {
    const channel = await resolveHandle('meucanal', 'test-key')
    assert.equal(channel.youtube_channel_id, 'UC1234567890123456789012')
    assert.equal(new URL(called).searchParams.get('forHandle'), 'meucanal')
    assert.equal(new URL(called).searchParams.get('part'), 'snippet')
  } finally { globalThis.fetch = original }
})

test('não aceita handle inválido nem resposta sem canal', async () => {
  await assert.rejects(resolveHandle('bad/handle', 'test-key'), /Handle inválido/)
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ items: [] })
  try { await assert.rejects(resolveHandle('meucanal', 'test-key'), /não encontrado/) }
  finally { globalThis.fetch = original }
})

test('erro de cota ou API indisponível fica explícito', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('', { status: 403 })
  try { await assert.rejects(resolveHandle('meucanal', 'test-key'), /HTTP 403/) }
  finally { globalThis.fetch = original }
})
