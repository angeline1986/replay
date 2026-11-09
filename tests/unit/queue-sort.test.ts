import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('Recentes na fila ordena canais e vídeos pela data adicionada, não pela publicação', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const videos = [
      { ...demoVideos[0], id: 'first', title: 'Primeiro na fila',
        published_at: '2026-11-08T00:00:00Z', state: { video_id: 'first',
          is_favorite: false, is_watched: false, is_queued: true,
          queued_at: '2026-11-08T10:00:00Z' } },
      { ...demoVideos[1], id: 'second', title: 'Outro canal',
        published_at: '2026-11-09T00:00:00Z', state: { video_id: 'second',
          is_favorite: false, is_watched: false, is_queued: true,
          queued_at: '2026-11-08T11:00:00Z' } },
      { ...demoVideos[0], id: 'third', title: 'Último adicionado',
        published_at: '2026-10-01T00:00:00Z', state: { video_id: 'third',
          is_favorite: false, is_watched: false, is_queued: true,
          queued_at: '2026-11-09T01:00:00Z' } }
    ]
    const view = videoView({ mode: 'queue', videos: [], collectionVideos: videos,
      channels: demoChannels, filter: { query: '', status: 'all', channelId: '' },
      sort: 'recent', hasMore: false, onFilter: () => {}, onSort: () => {},
      onToggle: () => {}, onFollow: () => {}, trackedVideoIds: new Set(), onLoadMore: () => {} })
    assert.deepEqual([...view.querySelectorAll('.favorite-channel-group h3')].map((node) => node.textContent),
      [demoChannels[0].name, demoChannels[1].name])
    assert.deepEqual([...view.querySelectorAll('.video-card h2')].map((node) => node.textContent),
      ['Último adicionado', 'Primeiro na fila', 'Outro canal'])
  } finally { globalThis.document = original; dom.window.close() }
})
