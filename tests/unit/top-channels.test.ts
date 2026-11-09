import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { channelView } from '../../src/features/channels/view.ts'
import { demoChannelIds, demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('troféu fornecido marca e desmarca canais tops no cartão', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const marked: string[] = []
    const view = channelView({
      channels: demoChannels, requests: [], videos: demoVideos,
      onAdd: () => {}, onToggle: () => {}, onRemove: () => {}, onOpen: () => {}, onMarked: () => {},
      onTop: (channel) => marked.push(channel.id)
    })
    const trophies = [...view.querySelectorAll<HTMLElement>('.channel-top-indicator')]
    assert.equal(trophies.length, 2)
    assert.equal(trophies[0].classList.contains('is-top'), true)
    assert.equal(trophies[1].classList.contains('is-top'), false)
    assert.match(trophies[0].querySelector<HTMLElement>('.channel-top-glyph')!.style.maskImage,
      /trophy-solid-full\.svg/)
    const cards = [...view.querySelectorAll('.channel-card')]
    for (const card of cards) {
      const trigger = card.querySelector<HTMLButtonElement>('.channel-options-trigger')!
      trigger.click()
      assert.equal(trigger.getAttribute('aria-expanded'), 'true')
      card.querySelector<HTMLButtonElement>('.channel-options-item')!.click()
      assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    }
    assert.deepEqual(marked, demoChannelIds)
  } finally {
    globalThis.document = original
    dom.window.close()
  }
})
