import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { videoView } from '../../src/features/videos/view.ts'
import { storiesView } from '../../src/features/stories/view.ts'
import { unfollowStory } from '../../src/shared/stories-api.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

function withDocument(run: () => void): void {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try { run() } finally { globalThis.document = previous; dom.window.close() }
}

test('vídeo despriorizado permite parar o acompanhamento sem mudar sua classificação', () => withDocument(() => {
  const video = { ...demoVideos[0], state: { video_id: demoVideos[0].id,
    is_favorite: false, is_watched: false, is_deprioritized: true } }
  const events: string[] = []
  const view = videoView({ mode: 'deprioritized', videos: [video], collectionVideos: [video],
    channels: demoChannels, filter: { query: '', status: 'all', channelId: '' },
    sort: 'recent', hasMore: false, trackedVideoIds: new Set([video.id]),
    onFilter: () => {}, onSort: () => {}, onLoadMore: () => {},
    onToggle: () => events.push('classificação'), onFollow: () => events.push('acompanhar'),
    onUnfollow: () => events.push('parar') })
  const runner = view.querySelector<HTMLButtonElement>('.icon-runner')!
  assert.equal(runner.disabled, false)
  assert.equal(runner.getAttribute('aria-label'), 'Deixar de acompanhar esta história')
  assert.equal(runner.getAttribute('aria-pressed'), 'true')
  assert.equal(view.querySelector('.icon-heart-crack')?.getAttribute('aria-pressed'), 'true')
  runner.click()
  assert.deepEqual(events, ['parar'])
  assert.equal(video.state.is_deprioritized, true)
}))

test('história sem sequência oferece parar acompanhamento e ordenação pedida', () => withDocument(() => {
  const story = { id: 's1', owner_id: 'owner', seed_video_id: demoVideos[0].id,
    name: 'Obra', canonical_key: 'obra', aliases: [], is_followed: true,
    completed_at: null, last_scanned_at: null, created_at: '2026-11-09T12:00:00Z' }
  const events: string[] = []
  const view = storiesView({ data: { groups: [{ story, seed: demoVideos[0],
    confirmed: [], pending: [] }], completed: [], pendingCount: 0 },
    channels: demoChannels, selectedChannelId: '', onChannelSelect: () => {},
    query: '', onQuery: () => {}, sort: 'recent', onSort: () => {},
    onLookupYouTube: async () => { throw Error('unused') }, onSaveYouTube: () => {},
    onToggleVideo: () => {}, onOpenSequence: () => {}, onComplete: () => {},
    onUnfollow: (item) => events.push(item.id) })
  assert.equal(view.querySelector('.follow-expand'), null)
  const stop = view.querySelector<HTMLButtonElement>('.follow-unfollow')!
  assert.equal(stop.textContent, 'Deixar de acompanhar')
  stop.click()
  assert.deepEqual(events, ['s1'])
  assert.deepEqual([...view.querySelectorAll('.favorite-sort [role="option"]')]
    .map((option) => option.textContent), ['A–Z', 'Recentes', 'Sequência'])
  assert.equal(view.querySelector('.favorite-sort .channel-picker-trigger')?.textContent, 'Recentes')
}))

test('parar acompanhamento atualiza só a história da proprietária', async () => {
  let updated: Record<string, unknown> | null = null
  const filters: [string, string][] = []
  const db = { from: (table: string) => {
    assert.equal(table, 'tracked_stories')
    return { update: (fields: Record<string, unknown>) => {
      updated = fields
      const query = { eq: (field: string, value: string) => { filters.push([field, value]); return query },
        select: async () => ({ data: [{ id: 'story-1' }], error: null }) }
      return query
    } }
  } } as unknown as SupabaseClient
  await unfollowStory(db, 'owner-1', 'story-1')
  assert.deepEqual(updated, { is_followed: false })
  assert.deepEqual(filters, [['id', 'story-1'], ['owner_id', 'owner-1']])
})
