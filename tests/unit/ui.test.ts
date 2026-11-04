import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { authView } from '../../src/features/auth/view.ts'
import { channelView } from '../../src/features/channels/view.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { demoChannelIds, demoChannels, demoVideos } from '../../src/shared/demo.ts'

function withDocument(run: (window: JSDOM['window']) => void): void {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try { run(dom.window) }
  finally { globalThis.document = original; dom.window.close() }
}

test('tela de canais dispara cadastro, pausa e abertura', () => withDocument((window) => {
  const events: string[] = []
  const view = channelView({
    channels: demoChannels, requests: [], videos: demoVideos,
    onAdd: (input) => events.push(`add:${input}`),
    onToggle: (channel) => events.push(`toggle:${channel.id}`),
    onRemove: (channel) => events.push(`remove:${channel.id}`),
    onOpen: (channel) => events.push(`open:${channel.id}`)
  })
  const input = view.querySelector('input')!
  input.value = '@canal'
  view.querySelector('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  const buttons = [...view.querySelectorAll<HTMLButtonElement>('.channel-card button')]
  buttons[0].click()
  buttons[1].click()
  buttons[2].click()
  assert.deepEqual(events, [
    'add:@canal', `open:${demoChannelIds[0]}`,
    `toggle:${demoChannelIds[0]}`, `remove:${demoChannelIds[0]}`
  ])
}))

test('tela de vídeos filtra e escapa título externo', () => withDocument(() => {
  const malicious = { ...demoVideos[0], title: '<script>alert(1)</script>' }
  const events: string[] = []
  const view = videoView({
    mode: 'videos', sort: 'recent',
    videos: [malicious, demoVideos[1]], channels: demoChannels,
    filter: { query: 'script', status: 'all', channelId: '' }, hasMore: false,
    onFilter: () => events.push('filter'),
    onSort: () => events.push('sort'),
    onToggle: (_video, key) => events.push(key),
    onLoadMore: () => events.push('more')
  })
  assert.equal(view.querySelectorAll('.video-card').length, 1)
  assert.equal(view.querySelector('.new-badge')?.textContent, 'Novo')
  assert.equal(view.querySelector('script'), null)
  assert.match(view.textContent ?? '', /<script>alert\(1\)<\/script>/)
  assert.equal(view.querySelector<HTMLAnchorElement>('.video-link')?.hostname, 'www.youtube.com')
  assert.equal(view.querySelector<HTMLSelectElement>('select[aria-label="Filtrar vídeos por canal"]')?.selectedOptions[0].textContent, 'Todos os canais')
  const actions = [...view.querySelectorAll<HTMLButtonElement>('.card-actions button')]
  actions[0].click()
  actions[1].click()
  assert.deepEqual(events, ['is_favorite', 'is_watched'])
}))

test('página de favoritos mostra somente marcados e ordena pelo título', () => withDocument(() => {
  const videos = [
    { ...demoVideos[0], title: 'Zebra', state: { video_id: 'demo-v1', is_favorite: true, is_watched: false } },
    { ...demoVideos[1], title: 'Sem favorito' },
    { ...demoVideos[1], id: 'demo-v3', title: 'Amora', state: { video_id: 'demo-v3', is_favorite: true, is_watched: true } }
  ]
  const view = videoView({
    mode: 'favorites', sort: 'az', videos, channels: demoChannels,
    filter: { query: '', status: 'all', channelId: '' }, hasMore: false,
    onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onLoadMore: () => {}
  })
  const titles = [...view.querySelectorAll('.video-card h2')].map((title) => title.textContent)
  assert.deepEqual(titles, ['Amora', 'Zebra'])
  assert.match(view.textContent ?? '', /Seus favoritos2/)
}))

test('tela de login prioriza GitHub e mantém recuperação por e-mail', () => withDocument((window) => {
  let sent = ''
  let github = 0
  const view = authView(() => { github++ }, (email) => { sent = email })
  const githubButton = view.querySelector<HTMLButtonElement>('.auth-github')!
  assert.equal(githubButton.textContent, 'Entrar com GitHub')
  githubButton.click()
  assert.equal(github, 1)
  view.querySelector('input')!.value = 'pessoa@example.com'
  view.querySelector('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.equal(sent, 'pessoa@example.com')
}))
