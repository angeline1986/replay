import assert from 'node:assert/strict'
import test from 'node:test'
import { runCollector, type CollectorStore } from '../../collector/jobs/run.ts'
import type { ActiveChannel } from '../../collector/persistence/store.ts'
import type { Uploads } from '../../collector/youtube/uploads.ts'

const channel: ActiveChannel = { id: 'local-channel', youtube_channel_id: 'UC1234567890123456789012' }

function store(channels: ActiveChannel[]) {
  const saved: Uploads[] = []
  const runs: string[] = []
  const value: CollectorStore = {
    activeChannels: async () => channels,
    saveUploads: async (_, uploads) => { saved.push(uploads) },
    recordRun: async (_, __, status) => { runs.push(status) },
    pruneRuns: async () => {}
  }
  return { value, saved, runs }
}

test('canais pausados não causam chamadas nem gravações', async () => {
  const db = store([])
  const fetcher = (async () => { throw new Error('rede não deveria ser usada') }) as typeof fetch
  assert.deepEqual(await runCollector('', db.value, fetcher),
    { active: 0, failures: 0, quotaUsed: 0 })
  assert.deepEqual(db.saved, [])
  assert.deepEqual(db.runs, [])
})

test('coleta ativa persiste uma vez e registra sucesso', async () => {
  const db = store([channel])
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    return Response.json(url.pathname.endsWith('/channels') ? {
      items: [{ id: channel.youtube_channel_id,
        contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }]
    } : { items: [{
      contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-11-02T10:00:00Z' },
      snippet: { title: 'Título', videoOwnerChannelId: channel.youtube_channel_id },
      status: { privacyStatus: 'public' }
    }] })
  }) as typeof fetch
  assert.deepEqual(await runCollector('test-key', db.value, fetcher),
    { active: 1, failures: 0, quotaUsed: 2 })
  assert.equal(db.saved[0].videos[0].youtube_video_id, 'abcdefghijk')
  assert.deepEqual(db.runs, ['success'])
})

test('canal ativo sem chave falha antes da rede', async () => {
  const db = store([channel])
  await assert.rejects(runCollector('', db.value), /YOUTUBE_API_KEY ausente/)
  assert.deepEqual(db.saved, [])
})

test('cota esgotada interrompe os canais seguintes sem gravar vídeos', async () => {
  const second = { ...channel, id: 'second-channel' }
  const db = store([channel, second])
  let calls = 0
  const fetcher = (async (input: URL | RequestInfo) => {
    calls++
    if (new URL(String(input)).pathname.endsWith('/channels')) return Response.json({
      items: [{ id: channel.youtube_channel_id,
        contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }]
    })
    return Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 })
  }) as typeof fetch
  const result = await runCollector('test-key', db.value, fetcher)
  assert.deepEqual(result, { active: 2, failures: 1, quotaUsed: 2 })
  assert.equal(calls, 2)
  assert.deepEqual(db.saved, [])
  assert.deepEqual(db.runs, ['error'])
})

test('mais de 100 canais ativos falham antes da API', async () => {
  const db = store(Array.from({ length: 101 }, (_, i) => ({ ...channel, id: String(i) })))
  await assert.rejects(runCollector('test-key', db.value), /100 canais ativos/)
})
