import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { videoId } from '../../supabase/functions/lookup-youtube-video/input.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { youtubeSearchView } from '../../src/features/videos/youtube-search.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('aceita links comuns do YouTube e rejeita domínios parecidos', () => {
  assert.equal(videoId('https://www.youtube.com/watch?v=Hx2SPzq2h4Q&t=10'), 'Hx2SPzq2h4Q')
  assert.equal(videoId('https://youtu.be/Hx2SPzq2h4Q'), 'Hx2SPzq2h4Q')
  assert.equal(videoId('https://www.youtube.com/shorts/Hx2SPzq2h4Q'), 'Hx2SPzq2h4Q')
  assert.equal(videoId('https://youtube.com.evil.test/watch?v=Hx2SPzq2h4Q'), null)
  assert.equal(videoId('http://youtube.com/watch?v=Hx2SPzq2h4Q'), null)
})

test('Concluídos usa a mesma busca do YouTube com ação de adicionar', async () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let saved = false
    const result = { youtube_video_id: 'Hx2SPzq2h4Q', youtube_channel_id: 'UC1234567890123456789012',
      channel_name: 'Canal público', title: 'Vídeo público', thumbnail_url: '', published_at: '2026-11-01T00:00:00Z' }
    const view = youtubeSearchView('completed', async () => result, () => { saved = true })
    view.querySelector<HTMLInputElement>('input')!.value = 'https://www.youtube.com/watch?v=Hx2SPzq2h4Q'
    view.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const button = view.querySelector<HTMLButtonElement>('.youtube-preview button')!
    assert.equal(button.textContent, 'Adicionar aos concluídos')
    button.click()
    assert.equal(saved, true)
  } finally { globalThis.document = original; dom.window.close() }
})

test('fila busca vídeo no YouTube e oferece adicioná-lo sem cadastrar canal', async () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let searched = ''
    let saved = ''
    const result = {
      youtube_video_id: 'Hx2SPzq2h4Q', youtube_channel_id: 'UC1234567890123456789012',
      channel_name: 'Canal público', title: 'Vídeo público',
      thumbnail_url: 'https://i.ytimg.com/vi/Hx2SPzq2h4Q/hqdefault.jpg',
      published_at: '2026-11-01T00:00:00Z'
    }
    const view = videoView({
      mode: 'queue', videos: demoVideos, collectionVideos: [], channels: demoChannels,
      filter: { query: '', status: 'all', channelId: '' }, sort: 'recent', hasMore: false,
      onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onFollow: () => {},
      trackedVideoIds: new Set(), onLoadMore: () => {},
      onLookupYouTube: async (input) => { searched = input; return result },
      onSaveYouTube: (video) => { saved = video.youtube_video_id }
    })
    assert.equal(view.textContent?.includes('Add Canal'), false)
    assert.equal(view.querySelector('.favorite-status'), null)
    assert.equal(view.querySelector('input[type="search"]')?.getAttribute('aria-label'), 'Buscar vídeo')
    const input = view.querySelector<HTMLInputElement>('.youtube-search input')!
    input.value = 'https://www.youtube.com/watch?v=Hx2SPzq2h4Q'
    view.querySelector<HTMLFormElement>('.youtube-search form')!
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(searched, input.value)
    assert.match(view.textContent ?? '', /Vídeo público/)
    view.querySelector<HTMLButtonElement>('.youtube-preview button')!.click()
    assert.equal(saved, 'Hx2SPzq2h4Q')
  } finally {
    globalThis.document = original
    dom.window.close()
  }
})

test('vídeo já presente na fila aparece sem ação duplicada', async () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let saved = false
    const view = youtubeSearchView('queue', async () => ({
      youtube_video_id: 'Hx2SPzq2h4Q', youtube_channel_id: 'UC1234567890123456789012',
      channel_name: 'Canal', title: 'Vídeo', thumbnail_url: '',
      published_at: '2026-11-01T00:00:00Z', already_added: true
    }), () => { saved = true })
    view.querySelector<HTMLInputElement>('input')!.value = 'https://www.youtube.com/watch?v=Hx2SPzq2h4Q'
    view.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const action = view.querySelector<HTMLButtonElement>('.youtube-preview button')!
    assert.equal(action.textContent, 'Já está na fila')
    assert.equal(action.disabled, true)
    action.click()
    assert.equal(saved, false)
  } finally { globalThis.document = original; dom.window.close() }
})
