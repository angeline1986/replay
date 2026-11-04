import assert from 'node:assert/strict'
import test from 'node:test'
import type { Video } from '../../collector/youtube/uploads.ts'

test('Supabase recebe upsert idempotente pela chave de canal e vídeo', async () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const rows = new Map<string, Video>()
  let upserts = 0
  let channelUpdates = 0
  process.env.SUPABASE_URL = 'https://local.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key'
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/videos')) {
      upserts++
      assert.equal(init?.method, 'POST')
      assert.equal(url.searchParams.get('on_conflict'), 'channel_id,youtube_video_id')
      assert.match(String(new Headers(init?.headers).get('prefer')), /resolution=merge-duplicates/)
      const body = JSON.parse(String(init?.body)) as Array<Video & { channel_id: string }>
      for (const row of body) rows.set(`${row.channel_id}:${row.youtube_video_id}`, row)
      return new Response(null, { status: 201 })
    }
    if (url.pathname.endsWith('/channels')) {
      channelUpdates++
      assert.equal(init?.method, 'PATCH')
      return new Response(null, { status: 204 })
    }
    throw new Error(`Requisição inesperada: ${url.pathname}`)
  }) as typeof fetch
  try {
    const { saveUploads } = await import('../../collector/persistence/store.ts')
    const channel = { id: '00000000-0000-0000-0000-000000000001',
      youtube_channel_id: 'UC1234567890123456789012' }
    const video: Video = { youtube_video_id: 'abcdefghijk', title: 'Título original',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      thumbnail_url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      published_at: '2026-11-02T10:00:00.000Z', youtube_updated_at: null }
    await saveUploads(channel, { videos: [video] })
    await saveUploads(channel, { videos: [{ ...video, title: 'Título novo' }] })
    await saveUploads(channel, { videos: [] })
    assert.equal(rows.size, 1)
    assert.equal(rows.values().next().value?.title, 'Título novo')
    assert.equal(upserts, 2)
    assert.equal(channelUpdates, 3)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})
