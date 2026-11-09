import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { selectPicker } from '../../src/shared/select-picker.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('dropdown usa o mesmo padrão do seletor de canais e permite escolha por teclado', () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let selected = ''
    const picker = selectPicker({ choices: [
      { value: 'recent', label: 'Recentes' }, { value: 'az', label: 'Título A–Z' }
    ], value: 'recent', label: 'Ordenar vídeos', onChange: (value) => { selected = value } })
    dom.window.document.body.append(picker)
    const trigger = picker.querySelector<HTMLButtonElement>('.channel-picker-trigger')!
    const options = [...picker.querySelectorAll<HTMLButtonElement>('.channel-picker-option')]
    assert.equal(options.length, 2)
    assert.equal(picker.querySelector('select'), null)
    assert.equal(trigger.textContent, 'Recentes')
    trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    options[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    assert.equal(dom.window.document.activeElement, options[1])
    options[1].click()
    assert.equal(selected, 'az')
    assert.equal(trigger.textContent, 'Título A–Z')
    assert.equal(options[1].getAttribute('aria-selected'), 'true')
  } finally { globalThis.document = previous; dom.window.close() }
})

test('filtros de vídeo não exibem selects nativos em nenhuma página', () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    for (const mode of ['favorites', 'videos', 'queue', 'deprioritized'] as const) {
      const view = videoView({ mode, videos: demoVideos, channels: demoChannels,
        filter: { query: '', status: 'all', channelId: '' }, sort: 'recent', hasMore: false,
        onFilter: () => {}, onSort: () => {}, onToggle: () => {},
        onFollow: () => {}, trackedVideoIds: new Set(), onLoadMore: () => {} })
      assert.equal(view.querySelector('select'), null, mode)
      assert.ok(view.querySelector('.favorite-sort .channel-picker-trigger'), mode)
    }
  } finally { globalThis.document = previous; dom.window.close() }
})

test('tipo e ordenação dos vídeos continuam aplicando os filtros', () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let status = '', sort = ''
    const view = videoView({ mode: 'videos', videos: demoVideos, channels: demoChannels,
      filter: { query: '', status: 'all', channelId: '' }, sort: 'recent', hasMore: false,
      onFilter: (value) => { status = value.status }, onSort: (value) => { sort = value },
      onToggle: () => {}, onFollow: () => {}, trackedVideoIds: new Set(), onLoadMore: () => {} })
    view.querySelector<HTMLButtonElement>('.favorite-status [data-channel-id="new"]')!.click()
    view.querySelector<HTMLButtonElement>('.favorite-sort [data-channel-id="az"]')!.click()
    assert.equal(status, 'new')
    assert.equal(sort, 'az')
  } finally { globalThis.document = previous; dom.window.close() }
})
