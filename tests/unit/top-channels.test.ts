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
    const trophies = [...view.querySelectorAll<HTMLButtonElement>('.channel-top-button')]
    assert.equal(trophies.length, 2)
    assert.equal(trophies[0].getAttribute('aria-pressed'), 'true')
    assert.equal(trophies[1].getAttribute('aria-pressed'), 'false')
    assert.match(trophies[0].querySelector<HTMLElement>('.channel-top-glyph')!.style.maskImage,
      /trophy-solid-full\.svg/)
    trophies[0].click()
    trophies[1].click()
    assert.deepEqual(marked, demoChannelIds)
  } finally {
    globalThis.document = original
    dom.window.close()
  }
})
