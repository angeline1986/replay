import assert from 'node:assert/strict'
import test from 'node:test'
import { youtube } from '../../supabase/functions/import-channel/youtube.ts'

const channelId = 'UC' + 'a'.repeat(22)
const playlistId = 'UU' + 'a'.repeat(22)
const videoId = '12345678901'

test('cadastro inicial busca so uma pagina de ate 50 videos', async () => {
  const original = globalThis.fetch
  const calls: URL[] = []
  globalThis.fetch = async (request) => {
    const url = new URL(String(request))
    calls.push(url)
    assert.equal(url.pathname, '/youtube/v3/playlistItems')
    assert.equal(url.searchParams.get('maxResults'), '50')
    assert.equal(url.searchParams.get('pageToken'), null)
    const items = Array.from({ length: 50 }, (_, i) => ({
      contentDetails: { videoId: String(i).padStart(11, '0'),
        videoPublishedAt: '2026-10-31T12:00:00Z' },
      snippet: { title: `Video ${i}`, videoOwnerChannelId: channelId },
      status: { privacyStatus: 'public' }
    }))
    return new Response(JSON.stringify({ items, nextPageToken: 'OUTRA_PAGINA' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const videos = await youtube.uploads('test-key', channelId, playlistId)
    assert.equal(videos.length, 50)
    assert.equal(calls.length, 1)
  } finally { globalThis.fetch = original }
})

test('videos nao publicos ou invalidos nao sao importados', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ items: [
    { contentDetails: { videoId, videoPublishedAt: '2026-10-31T12:00:00Z' },
      snippet: { title: 'Video publico', videoOwnerChannelId: channelId },
      status: { privacyStatus: 'public' } },
    { contentDetails: { videoId: '12345678902', videoPublishedAt: '2026-10-31T12:00:00Z' },
      snippet: { title: 'Privado' }, status: { privacyStatus: 'private' } }
  ] }), { status: 200 })
  try {
    const videos = await youtube.uploads('test-key', channelId, playlistId)
    assert.deepEqual(videos.map((video) => video.youtube_video_id), [videoId])
  } finally { globalThis.fetch = original }
})
