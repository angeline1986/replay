import assert from 'node:assert/strict'
import test from 'node:test'
import { detectStoryCandidates } from '../../collector/stories/detect.ts'
import type { CandidateRow, ScanStory, StoryStore, StoredVideo } from '../../collector/stories/types.ts'

const seed: StoredVideo = { id: 'seed', channel_id: 'channel-a',
  title: 'Lábios Afiados como uma Faca Parte 1',
  published_at: '2026-10-01T00:00:00Z', discovered_at: '2026-10-01T00:00:00Z' }
const sequel: StoredVideo = { id: 'sequel', channel_id: 'channel-a',
  title: 'Lábios Afiados como uma Faca Parte 2',
  published_at: '2026-10-02T00:00:00Z', discovered_at: '2026-10-02T00:00:00Z' }
const other: StoredVideo = { id: 'other', channel_id: 'channel-b',
  title: 'Lábios Afiados como uma Faca Parte 3',
  published_at: '2026-10-03T00:00:00Z', discovered_at: '2026-10-03T00:00:00Z' }

function fixture() {
  const story: ScanStory = { id: 'story', ownerId: 'owner',
    name: 'Lábios Afiados como uma Faca', aliases: [], seedVideoId: seed.id,
    lastScannedAt: null, updatedAt: '2026-10-01T00:00:00Z' }
  const matches = new Map<string, { row: CandidateRow; status: string }>()
  const calls = { videos: 0, scanned: 0, inserted: 0 }
  const store: StoryStore = {
    activeStories: async () => [story],
    context: async () => ({ knownVideoIds: new Set(matches.keys()), pattern: {
      title: story.name, aliases: story.aliases, channelIds: [seed.channel_id],
      lastPosition: { kind: 'part', first: 1, last: 1, season: null },
      latestPublishedAt: seed.published_at
    } }),
    videos: async () => { calls.videos++; return [seed, sequel, other] },
    addCandidates: async (rows) => {
      let inserted = 0
      for (const row of rows) {
        if (matches.has(row.video_id)) continue
        matches.set(row.video_id, { row, status: 'pending' })
        inserted++
      }
      calls.inserted += inserted
      return inserted
    },
    markScanned: async (_story, until) => { story.lastScannedAt = until; calls.scanned++ }
  }
  return { story, matches, calls, store }
}

test('varredura cria sugestões de dois canais, sem chamadas YouTube', async () => {
  const { matches, store } = fixture()
  const result = await detectStoryCandidates(store, '2026-10-04T00:00:00Z')
  assert.deepEqual(result, { stories: 1, candidates: 2, failures: 0 })
  assert.equal(matches.get('sequel')?.row.score, 95)
  assert.equal(matches.get('other')?.row.score, 78)
  assert.equal([...matches.values()].every((item) => item.status === 'pending'), true)
})

test('rejeição persiste e duas coletas não duplicam nem reabrem par', async () => {
  const { matches, calls, store } = fixture()
  await detectStoryCandidates(store, '2026-10-04T00:00:00Z')
  matches.get('sequel')!.status = 'rejected'
  const again = await detectStoryCandidates(store, '2026-10-05T00:00:00Z')
  assert.deepEqual(again, { stories: 1, candidates: 0, failures: 0 })
  assert.equal(matches.get('sequel')?.status, 'rejected')
  assert.equal(matches.size, 2)
  assert.equal(calls.inserted, 2)
  assert.equal(calls.scanned, 2)
})

test('falha de persistência mantém cursor para nova tentativa', async () => {
  const { story, store } = fixture()
  store.addCandidates = async () => { throw new Error('Falha de banco') }
  const originalError = console.error
  console.error = () => {}
  try {
    const result = await detectStoryCandidates(store, '2026-10-04T00:00:00Z')
    assert.deepEqual(result, { stories: 0, candidates: 0, failures: 1 })
    assert.equal(story.lastScannedAt, null)
  } finally { console.error = originalError }
})

test('sem histórias acompanhadas não consulta vídeos nem YouTube', async () => {
  const { calls, store } = fixture()
  store.activeStories = async () => []
  assert.deepEqual(await detectStoryCandidates(store),
    { stories: 0, candidates: 0, failures: 0 })
  assert.equal(calls.videos, 0)
})
