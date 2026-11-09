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
      stories: { groups: [], completed: [], pendingCount: 0 },
      load: async () => ({ rows: [{ video, addedAt: '2026-11-09T12:00:00Z' }] }) })
    dom.window.document.body.append(view)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const metrics = [...view.querySelectorAll('.summary-metric')]
    assert.equal(metrics.length, 7)
    assert.match(metrics.find((item) => item.getAttribute('href') === '#videos')?.textContent ?? '', /41/)
    const row = view.querySelector('tbody tr')!
    assert.match(row.textContent ?? '', /Favorito/)
    assert.match(row.textContent ?? '', /Visto/)
    assert.match(row.textContent ?? '', /Fila de espera/)
    assert.match(row.textContent ?? '', /09\/11\/2026/)
  } finally { globalThis.document = previous; dom.window.close() }
})
