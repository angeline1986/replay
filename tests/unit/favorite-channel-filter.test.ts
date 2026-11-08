import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

function options(mode: 'favorites' | 'videos') {
  const selected = { ...demoVideos[0], state: {
    video_id: demoVideos[0].id, is_favorite: true, is_watched: false
  } }
  const other = { ...demoVideos[1], state: {
    video_id: demoVideos[1].id, is_favorite: false, is_watched: false
  } }
  return {
    mode, videos: [selected, other], favoriteVideos: [selected],
    channels: demoChannels,
    filter: { query: '', status: 'all' as const, channelId: '' },
    sort: 'recent' as const, hasMore: false,
    onFilter: () => {}, onSort: () => {}, onToggle: () => {},
    onFollow: () => {}, trackedVideoIds: new Set<string>(), onLoadMore: () => {}
  }
}

test('favoritos lista somente canais com vídeos favoritos', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const favorites = videoView(options('favorites'))
    const select = favorites.querySelectorAll<HTMLButtonElement>('.favorite-channel-filter .channel-picker-option')
    assert.deepEqual([...select].map((item) => item.dataset.channelId),
      ['', demoVideos[0].channel_id])
    assert.equal(favorites.querySelectorAll('.video-card').length, 1)
    const feed = videoView(options('videos'))
    const feedSelect = feed.querySelectorAll('.favorite-channel-filter .channel-picker-option')
    assert.equal(feedSelect.length, demoChannels.length + 1)
    assert.ok(feed.querySelector('.favorite-channel-filter .channel-picker-trophy'))
  } finally {
    globalThis.document = original
    dom.window.close()
  }
})

test('favoritos usa lista completa, não só vídeos da primeira página', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const input = options('favorites')
    const other = { ...demoVideos[1], state: {
      video_id: demoVideos[1].id, is_favorite: true, is_watched: false
    } }
    input.favoriteVideos = [other]
    const view = videoView(input)
    const select = view.querySelectorAll<HTMLButtonElement>('.favorite-channel-filter .channel-picker-option')
    assert.deepEqual([...select].map((item) => item.dataset.channelId),
      ['', other.channel_id])
  } finally {
    globalThis.document = original
    dom.window.close()
  }
})
