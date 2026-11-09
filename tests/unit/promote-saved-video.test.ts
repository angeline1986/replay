import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JSDOM } from 'jsdom'
import { promoteSavedVideo } from '../../src/shared/promote-saved-video.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

const external = { ...demoVideos[0], id: 'saved-1', channel_id: demoChannels[0].youtube_channel_id,
  external: true as const, state: { video_id: 'saved-1', is_favorite: false, is_watched: false,
    is_queued: true, is_deprioritized: false } }

function fakeDb(imported: boolean) {
  const calls: string[] = []
  let saved = true
  let state: Record<string, unknown> | null = null
  const db = { from: (table: string) => {
    calls.push(table)
    const query = {
      select: () => query, eq: () => query, limit: () => query,
      maybeSingle: async () => ({ data: table === 'channels' ? { id: demoChannels[0].id }
        : table === 'videos' ? imported ? { id: demoVideos[0].id } : null
          : table === 'saved_youtube_videos' ? saved ? { id: 'saved-1', is_queued: true, is_deprioritized: false } : null
            : state, error: null }),
      upsert: async (value: Record<string, unknown>) => { state = value; return { error: null } },
      delete: () => ({ eq: async () => { saved = false; return { error: null } } })
    }
    return query
  }, functions: { invoke: async () => {
    calls.push('edge-save')
    imported = true
    return { data: { video_id: demoVideos[0].id }, error: null }
  } } } as unknown as SupabaseClient
  return { db, calls, isSaved: () => saved }
}

test('vídeo avulso já importado preserva a fila e vira vídeo completo sem nova função', async () => {
  const { db, calls, isSaved } = fakeDb(true)
  const result = await promoteSavedVideo(db, 'owner', external)
  assert.equal(result.id, demoVideos[0].id)
  assert.equal(result.external, undefined)
  assert.equal(result.state?.is_queued, true)
  assert.equal(isSaved(), false)
  assert.equal(calls.includes('edge-save'), false)
})

test('vídeo avulso fora dos 50 iniciais é salvo e mantém classificação', async () => {
  const { db, calls, isSaved } = fakeDb(false)
  const result = await promoteSavedVideo(db, 'owner', external)
  assert.equal(result.id, demoVideos[0].id)
  assert.equal(result.state?.is_queued, true)
  assert.equal(isSaved(), false)
  assert.equal(calls.filter((call) => call === 'edge-save').length, 1)
})

test('cartão avulso mostra os cinco ícones e cada ação correta', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const calls: string[] = []
    const view = videoView({ mode: 'queue', videos: [], collectionVideos: [external],
      channels: demoChannels, filter: { query: '', status: 'all', channelId: '' }, sort: 'recent',
      hasMore: false, onFilter: () => {}, onSort: () => {}, onLoadMore: () => {},
      onToggle: (_video, key) => calls.push(key), onFollow: () => calls.push('follow'),
      onToggleSaved: (_video, key) => calls.push(`saved:${key}`), trackedVideoIds: new Set() })
    const icons = [...view.querySelectorAll<HTMLButtonElement>('.video-card .icon-action')]
    assert.equal(icons.length, 5)
    for (const icon of icons) icon.click()
    assert.deepEqual(calls, ['is_favorite', 'is_watched', 'follow',
      'saved:is_queued', 'saved:is_deprioritized'])
  } finally { globalThis.document = original; dom.window.close() }
})
