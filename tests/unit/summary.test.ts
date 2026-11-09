import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { summaryView } from '../../src/features/summary/view.ts'
import { routeFromHash } from '../../src/app/route.ts'
import { sidebarView } from '../../src/app/shell.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('Resumo fica antes de Consumo e mostra contagens e vídeos marcados', async () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    assert.equal(routeFromHash('#summary').page, 'summary')
    const sidebar = sidebarView('summary', true)
    const links = [...sidebar.querySelectorAll('nav a')].map((link) => link.getAttribute('href'))
    assert.ok(links.indexOf('#summary') < links.indexOf('#usage'))
    const video = { ...demoVideos[0], state: { video_id: demoVideos[0].id,
      is_favorite: true, is_watched: true, is_queued: true, is_deprioritized: false } }
    const view = summaryView({ channels: demoChannels, launchCount: 41,
      favorites: [video], queued: [video], deprioritized: [],
      stories: { groups: [{ story: { id: 'story-1', owner_id: 'owner',
        seed_video_id: video.id, name: 'Obra', canonical_key: 'obra', aliases: [],
        is_followed: true, completed_at: null, last_scanned_at: null,
        created_at: '2026-11-08T12:00:00Z' }, seed: video,
      confirmed: [], pending: [{ id: 'candidate-1', story_id: 'story-1', video_id: demoVideos[1].id,
        status: 'pending', score: 0.9, reason: 'continuação', detected_at: '2026-11-09T12:00:00Z',
        decided_at: null, video: demoVideos[1] }] }], completed: [], pendingCount: 1 },
      load: async () => ({ rows: [{ video, addedAt: '2026-11-09T12:00:00Z' }] }) })
    dom.window.document.body.append(view)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const metrics = [...view.querySelectorAll('.summary-metric')]
    assert.equal(metrics.length, 8)
    assert.match(metrics.find((item) => item.getAttribute('href') === '#videos')?.textContent ?? '', /41/)
    assert.match(metrics.find((item) => item.textContent?.includes('Vídeos com continuação'))?.textContent ?? '', /1/)
    const row = view.querySelector('tbody tr')!
    assert.ok(row.querySelector('[aria-label="Favorito"] svg'))
    assert.ok(row.querySelector('[aria-label="Visto"] svg'))
    assert.ok(row.querySelector('[aria-label="Fila de espera"] .supplied-svg-icon'))
    assert.ok(row.querySelector('[aria-label="Acompanhando"] svg'))
    assert.match(row.textContent ?? '', /09\/11\/2026/)
  } finally { globalThis.document = previous; dom.window.close() }
})
