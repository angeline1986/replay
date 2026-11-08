import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { channelView } from '../../src/features/channels/view.ts'
import { storiesView } from '../../src/features/stories/view.ts'
import { loadStoryDashboard } from '../../src/shared/stories-api.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

function withDocument(run: (window: JSDOM['window']) => void): void {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try { run(dom.window) }
  finally { globalThis.document = original; dom.window.close() }
}

test('canais tops podem aparecer primeiro ou sozinhos sem mudar a marcação', () => withDocument((window) => {
  const reordered = [demoChannels[1], demoChannels[0]]
  const selected: string[] = []
  const base = { channels: reordered, requests: [], videos: demoVideos,
    onAdd: () => {}, onToggle: () => {}, onTop: () => {}, onRemove: () => {}, onOpen: () => {},
    onTopFilter: (value: string) => selected.push(value) }
  const first = channelView({ ...base, topFilter: 'top-first' })
  assert.deepEqual([...first.querySelectorAll('.channel-card h2')].map((node) => node.textContent),
    [demoChannels[0].name, demoChannels[1].name])
  const filter = first.querySelector<HTMLSelectElement>('.channel-top-filter')!
  filter.value = 'top-only'
  filter.dispatchEvent(new window.Event('change'))
  assert.deepEqual(selected, ['top-only'])
  const only = channelView({ ...base, topFilter: 'top-only' })
  assert.equal(only.querySelectorAll('.channel-card').length, 1)
  assert.equal(only.querySelector('.favorite-total')?.textContent, '1')
  assert.equal(only.querySelector<HTMLSelectElement>('.channel-jump')?.options.length, 2)
  assert.equal(reordered[1].is_top, true)
}))

test('histórias têm divisores por canal e ações de favorito e visto no cartão e na sequência', () => withDocument(() => {
  const events: string[] = []
  const story = (id: string, videoId: string) => ({ id, owner_id: 'owner', seed_video_id: videoId,
    name: `Obra ${id}`, canonical_key: id, aliases: [], is_followed: true,
    last_scanned_at: null, created_at: '2026-11-04T00:00:00Z' })
  const videos = [
    { ...demoVideos[0], state: { video_id: demoVideos[0].id, is_favorite: true, is_watched: false } },
    { ...demoVideos[1], state: { video_id: demoVideos[1].id, is_favorite: false, is_watched: true } }
  ]
  const view = storiesView({ channels: demoChannels,
    data: { groups: videos.map((video, index) => ({ story: story(`s${index}`, video.id), seed: video,
      confirmed: [], pending: [] })), pendingCount: 0 },
    onDecide: () => {}, onRename: () => {}, onUnfollow: () => {},
    onToggleVideo: (video, key) => events.push(`${video.id}:${key}`) })
  assert.deepEqual([...view.querySelectorAll('.favorite-channel-heading h3')].map((node) => node.textContent),
    demoChannels.map((channel) => channel.name))
  assert.equal(view.querySelectorAll('.favorite-channel-group .follow-grid').length, 2)
  const first = view.querySelector('.follow-card')!
  const buttons = [...first.querySelectorAll<HTMLButtonElement>('.follow-tags .icon-action')]
  assert.deepEqual(buttons.map((node) => node.getAttribute('aria-pressed')), ['true', 'false'])
  buttons.forEach((node) => node.click())
  first.querySelector<HTMLButtonElement>('.follow-expand')!.click()
  first.querySelector<HTMLButtonElement>('.follow-video .icon-eye-slash')!.click()
  assert.deepEqual(events, ['demo-v1:is_favorite', 'demo-v1:is_watched', 'demo-v1:is_watched'])
}))

test('carregamento de histórias inclui os estados pessoais dos vídeos', async () => {
  const story = { id: 's1', owner_id: 'owner', seed_video_id: 'demo-v1', name: 'Obra',
    canonical_key: 'obra', aliases: [], is_followed: true, last_scanned_at: null,
    created_at: '2026-11-04T00:00:00Z' }
  const queries: string[] = []
  const rows: Record<string, unknown[]> = {
    tracked_stories: [story], story_matches: [], videos: [demoVideos[0]],
    user_video_state: [{ video_id: 'demo-v1', is_favorite: true, is_watched: true }]
  }
  const db = { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      range: () => ({ data: rows[table], error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: rows[table], error: null })
    }
    queries.push(table)
    return query
  } } as unknown as SupabaseClient
  const result = await loadStoryDashboard(db, 'owner', demoChannels)
  assert.equal(result.groups[0].seed?.state?.is_favorite, true)
  assert.equal(result.groups[0].seed?.state?.is_watched, true)
  assert.ok(queries.includes('user_video_state'))
})
