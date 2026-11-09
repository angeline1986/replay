import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findVideoMenu } from '../../src/features/videos/find-menu.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { storiesView } from '../../src/features/stories/view.ts'
import { findReplayVideos } from '../../src/shared/find-video.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('menu escondido oferece buscas distintas e usa a ação da página', async () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let replaySearch = '', youtubeSearch = '', selected = '', shown = ''
    const finder = findVideoMenu({ target: 'favorites',
      searchReplay: async (input) => { replaySearch = input; return [demoVideos[0]] },
      searchYouTube: async (input) => { youtubeSearch = input; return {
        youtube_video_id: demoVideos[1].youtube_video_id,
        youtube_channel_id: demoChannels[1].youtube_channel_id,
        channel_name: demoChannels[1].name, title: demoVideos[1].title,
        thumbnail_url: '', published_at: demoVideos[1].published_at
      } },
      isAdded: (id) => id === demoVideos[1].youtube_video_id,
      selectReplay: async (video) => { selected = video.youtube_video_id },
      selectYouTube: async () => { throw new Error('Não deveria adicionar vídeo já marcado.') },
      showAdded: (id) => { shown = id }
    })
    dom.window.document.body.append(finder)
    assert.equal(finder.querySelector<HTMLElement>('.find-video-options')?.hidden, true)
    finder.querySelector<HTMLButtonElement>('.find-video-trigger')!.click()
    finder.querySelectorAll<HTMLButtonElement>('.find-video-option')[0].click()
    assert.equal(finder.querySelector<HTMLElement>('.find-video-panel')?.hidden, false)
    const form = finder.querySelector<HTMLFormElement>('.find-video-form')!
    const input = form.querySelector<HTMLInputElement>('input')!
    input.value = 'projeto'
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(replaySearch, 'projeto')
    const action = finder.querySelector<HTMLButtonElement>('.find-video-result button')!
    assert.equal(action.textContent, 'Favoritar')
    action.click()
    assert.equal(selected, demoVideos[0].youtube_video_id)
    finder.querySelector<HTMLButtonElement>('.find-video-trigger')!.click()
    finder.querySelectorAll<HTMLButtonElement>('.find-video-option')[1].click()
    input.value = `https://www.youtube.com/watch?v=${demoVideos[1].youtube_video_id}`
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(youtubeSearch, input.value)
    const existing = finder.querySelector<HTMLButtonElement>('.find-video-result button')!
    assert.equal(existing.textContent, 'Mostrar na página')
    existing.click()
    assert.equal(shown, demoVideos[1].youtube_video_id)
  } finally { globalThis.document = original; dom.window.close() }
})

test('menu aparece em Favoritos e Minhas histórias, quando configurado', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const finder = { target: 'favorites' as const, searchReplay: async () => [],
      searchYouTube: async () => { throw new Error('Busca não chamada') }, isAdded: () => false,
      selectReplay: async () => {}, selectYouTube: async () => {}, showAdded: () => {} }
    const videos = (mode: 'favorites' | 'videos') => videoView({ mode, videos: demoVideos,
      channels: demoChannels, filter: { query: '', status: 'all', channelId: '' }, sort: 'recent',
      hasMore: false, onFilter: () => {}, onSort: () => {}, onToggle: () => {},
      onFollow: () => {}, trackedVideoIds: new Set(), onLoadMore: () => {},
      finder: mode === 'favorites' ? finder : undefined })
    assert.ok(videos('favorites').querySelector('.find-video-trigger'))
    assert.equal(videos('favorites').querySelector('.favorite-toolbar-controls > input'), null)
    assert.equal(videos('videos').querySelector('.find-video-trigger'), null)
    const stories = (mode: 'active' | 'completed') => storiesView({
      data: { groups: [], completed: [], pendingCount: 0 }, mode, channels: demoChannels,
      selectedChannelId: '', onChannelSelect: () => {}, query: '', onQuery: () => {},
      sort: 'recent', onSort: () => {}, onLookupYouTube: async () => { throw new Error('Busca não chamada') },
      onSaveYouTube: () => {}, onToggleVideo: () => {}, onOpenSequence: () => {},
      onComplete: () => {}, finder: { ...finder, target: 'stories' }
    })
    assert.ok(stories('active').querySelector('.find-video-trigger'))
    assert.equal(stories('completed').querySelector('.find-video-trigger'), null)
  } finally { globalThis.document = original; dom.window.close() }
})

test('busca no RePlay consulta o catálogo por título e por link sem chamar YouTube', async () => {
  const calls: string[] = []
  const db = { from: (table: string) => {
    calls.push(table)
    const query = { select: () => query, eq: (column: string, value: string) => {
      if (column === 'youtube_video_id') calls.push(`id:${value}`)
      return query
    }, ilike: (_column: string, value: string) => { calls.push(`title:${value}`); return query },
    order: () => query, limit: async () => ({ data: table === 'videos' ? [demoVideos[0]] : [], error: null }),
    in: async () => ({ data: [{ video_id: demoVideos[0].id, is_favorite: true, is_watched: false }], error: null }) }
    return query
  } } as unknown as SupabaseClient
  const byTitle = await findReplayVideos(db, 'owner', 'projeto', demoChannels)
  assert.equal(byTitle[0].state?.is_favorite, true)
  assert.equal(byTitle[0].channel?.name, demoChannels[0].name)
  assert.ok(calls.includes('title:%projeto%'))
  calls.length = 0
  const byLink = await findReplayVideos(db, 'owner', `https://www.youtube.com/watch?v=${demoVideos[0].youtube_video_id}`, demoChannels)
  assert.equal(byLink[0].youtube_video_id, demoVideos[0].youtube_video_id)
  assert.ok(calls.includes(`id:${demoVideos[0].youtube_video_id}`))
  assert.equal(calls.some((call) => call.startsWith('title:')), false)
})

test('busca no RePlay também localiza vídeos salvos fora do catálogo monitorado', async () => {
  const id = 'PkHMJNqs-tk'
  const db = { from: (table: string) => {
    const query = { select: () => query, eq: () => query, ilike: () => query,
      order: () => query, limit: async () => ({ data: table === 'saved_youtube_videos' ? [{
        id: 'saved-1', youtube_video_id: id, youtube_channel_id: demoChannels[0].youtube_channel_id,
        channel_name: 'Canal salvo', title: 'Vídeo avulso', thumbnail_url: '',
        published_at: '2026-01-01T00:00:00Z', is_queued: true, is_deprioritized: false,
        queued_at: '2026-11-09T10:00:00Z', deprioritized_at: null
      }] : [], error: null }) }
    return query
  } } as unknown as SupabaseClient
  const results = await findReplayVideos(db, 'owner', `https://www.youtube.com/watch?v=${id}`, demoChannels)
  assert.equal(results.length, 1)
  assert.equal(results[0].external, true)
  assert.equal(results[0].channel?.name, 'Canal salvo')
})
