import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiBudget } from '../../collector/youtube/client.ts'
import { processRequests } from '../../collector/jobs/requests.ts'
import { runCollector } from '../../collector/jobs/run.ts'
import type { ActiveChannel } from '../../collector/persistence/store.ts'

const youtubeId = 'UC1234567890123456789012'

test('handle pendente entra na coleta atual, sem segunda execução', async () => {
  const originalFetch = globalThis.fetch
  const old = ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .map((key) => process.env[key])
  process.env.YOUTUBE_API_KEY = 'test-key'
  process.env.SUPABASE_URL = 'https://local.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test'
  let resolved = false
  const paths: string[] = []
  let savedVideos = 0
  const channels: ActiveChannel[] = []
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === 'www.googleapis.com') {
      paths.push(`youtube:${url.searchParams.has('forHandle') ? 'handle' : url.pathname.split('/').pop()}`)
      if (url.searchParams.has('forHandle')) return Response.json({ items: [{
        id: youtubeId, snippet: { title: 'Slime', thumbnails: {} }
      }] })
      if (url.pathname.endsWith('/channels')) return Response.json({ items: [{
        id: youtubeId, contentDetails: { relatedPlaylists: { uploads: 'UU123' } }
      }] })
      return Response.json({ items: [{
        contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-11-05T10:00:00Z' },
        snippet: { title: 'Capítulo 1', videoOwnerChannelId: youtubeId },
        status: { privacyStatus: 'public' }
      }] })
    }
    if (url.pathname.endsWith('/channel_requests')) {
      if (init?.method === 'PATCH') { resolved = true; return Response.json({}) }
      return Response.json([{ id: 'request-1', owner_id: 'owner-1', handle: 'SlimeManhwaRecap' }])
    }
    if (url.pathname.endsWith('/channels')) {
      if (init?.method === 'POST') {
        channels.push({ id: 'new-channel', youtube_channel_id: youtubeId })
        return Response.json({})
      }
      return Response.json(channels)
    }
    if (url.pathname.endsWith('/videos')) { savedVideos++; return Response.json({}) }
    if (url.pathname.endsWith('/sync_runs')) return Response.json({})
    throw new Error(`Rota inesperada: ${url.pathname}`)
  }) as typeof fetch
  try {
    const budget = new ApiBudget()
    const requests = await processRequests(20, budget)
    assert.equal(requests.failures, 0)
    assert.equal(requests.calls, 1)
    assert.equal(resolved, true)
    const result = await runCollector('test-key', {
      activeChannels: async () => channels,
      saveUploads: async (_, uploads) => { savedVideos += uploads.videos.length },
      recordRun: async () => {}, pruneRuns: async () => {}
    }, globalThis.fetch, budget)
    assert.equal(result.active, 1)
    assert.equal(result.videos, 1)
    assert.equal(savedVideos, 1)
    assert.equal(budget.used, 3)
    assert.deepEqual(paths, ['youtube:handle', 'youtube:channels', 'youtube:playlistItems'])
  } finally {
    globalThis.fetch = originalFetch
    for (const [i, key] of ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].entries()) {
      if (old[i] === undefined) delete process.env[key]
      else process.env[key] = old[i]
    }
  }
})

test('sem vagas de canal, solicitações continuam pendentes sem chamada', async () => {
  const result = await processRequests(0, new ApiBudget())
  assert.deepEqual(result, { failures: 0, calls: 0, quotaStopped: false })
})
