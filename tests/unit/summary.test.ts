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

test('Resumo filtra a tabela por canal e marcação sem recarregar dados', () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const favorite = { ...demoVideos[0], state: { video_id: demoVideos[0].id,
      is_favorite: true, is_watched: false } }
    const queued = { ...demoVideos[1], state: { video_id: demoVideos[1].id,
      is_favorite: false, is_watched: false, is_queued: true } }
    const view = summaryView({ channels: demoChannels, launchCount: 2,
      favorites: [favorite], queued: [queued], deprioritized: [],
      stories: { groups: [], completed: [], pendingCount: 0 },
      demoVideos: [favorite, queued] })
    dom.window.document.body.append(view)
    assert.equal(view.querySelector('.summary-table-section h2'), null)
    assert.equal(view.querySelector('.summary-table-toolbar'), null)
    assert.equal(view.querySelectorAll('tbody tr').length, 2)
    const channelFilter = view.querySelector('thead th:first-child .summary-channel-filter')!
    assert.ok(channelFilter.querySelector('[title="Ateliê Criativo"] .channel-picker-trophy'))
    const markFilter = view.querySelector('thead th:last-child .summary-mark-filter')!
    assert.equal(channelFilter.querySelector('.channel-picker-trigger')?.textContent, 'Canal')
    assert.equal(markFilter.querySelector('.channel-picker-trigger')?.textContent, 'Marcações')
    const select = (filter: Element, id: string) => {
      (filter.querySelector(`[data-channel-id="${id}"]`) as HTMLElement).click()
    }
    select(channelFilter, demoChannels[0].id)
    const rows = [...view.querySelectorAll<HTMLTableRowElement>('tbody tr')]
    assert.deepEqual(rows.map((row) => row.hidden), [false, true])
    select(markFilter, 'hourglass')
    assert.equal(view.querySelector('.summary-table-scroll')?.hasAttribute('hidden'), false)
    assert.equal(channelFilter.querySelector('.channel-picker-trigger')?.textContent, 'Ateliê Criativo')
    assert.equal((view.querySelector('.summary-table-section .notice') as HTMLElement).hidden, false)
    assert.match(view.querySelector('.summary-table-section .notice')?.textContent ?? '',
      /Nenhum vídeo corresponde aos filtros/)
    select(channelFilter, demoChannels[1].id)
    assert.deepEqual(rows.map((row) => row.hidden), [true, false])
    assert.equal(view.querySelector('.summary-table-scroll')?.hasAttribute('hidden'), false)
  } finally { globalThis.document = previous; dom.window.close() }
})
