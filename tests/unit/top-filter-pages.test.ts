import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { storiesView } from '../../src/features/stories/view.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'
import type { Video } from '../../src/shared/model.ts'
import type { TopFilter } from '../../src/shared/top-filter.ts'

function withDocument(run: () => void): void {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try { run() }
  finally { globalThis.document = previous; dom.window.close() }
}

test('Lançamentos filtra Topzera e mantém o destaque por canal', () => withDocument(() => {
  const videos = [
    { ...demoVideos[1], published_at: '2026-11-02T00:00:00Z' },
    { ...demoVideos[0], published_at: '2026-11-01T00:00:00Z' }
  ]
  const changes: TopFilter[] = []
  const base = { mode: 'videos' as const, videos, highlights: videos, channels: demoChannels,
    filter: { query: '', status: 'all' as const, channelId: '' }, sort: 'recent' as const,
    hasMore: true, onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onFollow: () => {},
    trackedVideoIds: new Set<string>(), onLoadMore: () => {}, onTopFilter: (value: TopFilter) => changes.push(value) }
  const all = videoView(base)
  assert.deepEqual([...all.querySelectorAll('.video-card h2')].map((item) => item.textContent),
    [videos[0].title, videos[1].title])
  all.querySelector<HTMLButtonElement>('.channel-top-filter .channel-picker-trigger')!.click()
  all.querySelector<HTMLButtonElement>('.channel-top-filter [data-channel-id="top-only"]')!.click()
  assert.deepEqual(changes, ['top-only'])
  const only = videoView({ ...base, topFilter: 'top-only' })
  assert.deepEqual([...only.querySelectorAll('.video-card h2')].map((item) => item.textContent), [videos[1].title])
  assert.equal(only.querySelector('.favorite-total')?.textContent, '1')
  assert.equal(only.querySelector('.load-more'), null)
  const first = videoView({ ...base, topFilter: 'top-first' })
  assert.deepEqual([...first.querySelectorAll('.video-card h2')].map((item) => item.textContent),
    [videos[1].title, videos[0].title])
}))

test('Fila de espera prioriza e filtra vídeos de canal Topzera, inclusive externos', () => withDocument(() => {
  const queued = (video: Video, channelId = video.channel_id): Video => ({ ...video,
    channel_id: channelId, state: { video_id: video.id, is_favorite: false, is_watched: false, is_queued: true } })
  const videos = [queued({ ...demoVideos[1], published_at: '2026-11-02T00:00:00Z' }),
    queued(demoVideos[0], demoChannels[0].youtube_channel_id)]
  const base = { mode: 'queue' as const, videos: [], collectionVideos: videos, channels: demoChannels,
    filter: { query: '', status: 'all' as const, channelId: '' }, sort: 'recent' as const,
    hasMore: false, onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onFollow: () => {},
    trackedVideoIds: new Set<string>(), onLoadMore: () => {} }
  const first = videoView({ ...base, topFilter: 'top-first' })
  assert.deepEqual([...first.querySelectorAll('.favorite-channel-heading h3')].map((item) => item.textContent),
    [demoChannels[0].name, demoChannels[1].name])
  const only = videoView({ ...base, topFilter: 'top-only' })
  assert.equal(only.querySelector('.favorite-total')?.textContent, '1')
  assert.equal(only.querySelectorAll('.video-card').length, 1)
  assert.equal(only.querySelector('.video-card h2')?.textContent, demoVideos[0].title)
  assert.ok(only.querySelector('.channel-top-filter'))
}))

test('Minhas histórias prioriza e filtra Topzera sem alterar Concluídos', () => withDocument(() => {
  const group = (video: Video) => ({ story: { id: video.id, owner_id: 'owner', seed_video_id: video.id,
    name: video.title, canonical_key: video.id, aliases: [], is_followed: true, completed_at: null,
    last_scanned_at: null, created_at: video.published_at }, seed: video, confirmed: [], pending: [] })
  const videos = [
    { ...demoVideos[1], published_at: '2026-11-02T00:00:00Z' },
    { ...demoVideos[0], published_at: '2026-11-01T00:00:00Z' }
  ]
  const changes: TopFilter[] = []
  const base = { data: { groups: videos.map(group), completed: [], pendingCount: 0 }, channels: demoChannels,
    selectedChannelId: '', onChannelSelect: () => {}, query: '', onQuery: () => {},
    sort: 'recent' as const, onSort: () => {}, onLookupYouTube: async () => { throw Error('unused') },
    onSaveYouTube: () => {}, onToggleVideo: () => {}, onOpenSequence: () => {}, onComplete: () => {},
    onTopFilter: (value: TopFilter) => changes.push(value) }
  const all = storiesView(base)
  all.querySelector<HTMLButtonElement>('.channel-top-filter .channel-picker-trigger')!.click()
  all.querySelector<HTMLButtonElement>('.channel-top-filter [data-channel-id="top-first"]')!.click()
  assert.deepEqual(changes, ['top-first'])
  const first = storiesView({ ...base, topFilter: 'top-first' })
  assert.deepEqual([...first.querySelectorAll('.favorite-channel-heading h3')].map((item) => item.textContent),
    [demoChannels[0].name, demoChannels[1].name])
  const only = storiesView({ ...base, topFilter: 'top-only' })
  assert.equal(only.querySelectorAll('.follow-card').length, 1)
  assert.equal(only.querySelector('.favorite-total')?.textContent, '1')
  assert.equal(only.querySelector('.follow-card h2')?.textContent, videos[1].title)
  assert.equal(storiesView({ ...base, mode: 'completed', topFilter: 'top-only' }).querySelector('.channel-top-filter'), null)
}))
