import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { authView } from '../../src/features/auth/view.ts'
import { channelView } from '../../src/features/channels/view.ts'
import { videoView } from '../../src/features/videos/view.ts'
import { storiesView } from '../../src/features/stories/view.ts'
import { sidebarView } from '../../src/app/shell.ts'
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

test('seletor de canais localiza o cartão sem cadastrar outro canal', () => withDocument((window) => {
  const added: string[] = []
  const view = channelView({
    channels: demoChannels, requests: [], videos: demoVideos,
    onAdd: (input) => added.push(input),
    onToggle: () => {}, onRemove: () => {}, onOpen: () => {}
  })
  const select = view.querySelector<HTMLSelectElement>('.channel-jump')!
  assert.equal(select.options.length, 3)
  select.value = demoChannelIds[1]
  select.dispatchEvent(new window.Event('change'))
  const cards = [...view.querySelectorAll('.channel-card')]
  assert.equal(cards[0].classList.contains('channel-card-selected'), false)
  assert.equal(cards[1].classList.contains('channel-card-selected'), true)
  assert.deepEqual(added, [])
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
    onFollow: () => events.push('follow'), trackedVideoIds: new Set(),
    onLoadMore: () => events.push('more')
  })
  assert.equal(view.querySelectorAll('.video-card').length, 1)
  assert.equal(view.querySelector('.new-badge')?.textContent, 'Novo')
  const icons = [...view.querySelectorAll<HTMLButtonElement>('.card-actions .icon-action')]
  assert.equal(icons.length, 3)
  assert.deepEqual(icons.map((node) => node.getAttribute('aria-label')),
    ['Adicionar aos favoritos', 'Marcar como visto', 'Acompanhar esta história'])
  assert.deepEqual(icons.map((node) => node.querySelector('svg')?.getAttribute('viewBox')),
    ['0 0 640 640', '0 0 640 640', '0 0 640 640'])
  assert.deepEqual(icons.map((node) => node.getAttribute('aria-pressed')),
    ['false', 'false', 'false'])
  assert.equal(icons[1].classList.contains('icon-eye-slash'), true)
  assert.equal(view.querySelector('script'), null)
  assert.match(view.textContent ?? '', /<script>alert\(1\)<\/script>/)
  assert.equal(view.querySelector<HTMLAnchorElement>('.video-link')?.hostname, 'www.youtube.com')
  assert.equal(view.querySelector<HTMLSelectElement>('select[aria-label="Filtrar vídeos por canal"]')?.selectedOptions[0].textContent, 'Todos os canais')
  const actions = [...view.querySelectorAll<HTMLButtonElement>('.card-actions button')]
  actions[0].click()
  actions[1].click()
  actions[2].click()
  assert.deepEqual(events, ['is_favorite', 'is_watched', 'follow'])
}))

test('Minhas histórias mostra pendências e executa confirmar, rejeitar e corrigir nome', () => withDocument(() => {
  const events: string[] = []
  const story = { id: 'story', owner_id: 'owner', seed_video_id: demoVideos[0].id,
    name: 'Obra <Nova>', canonical_key: 'obra nova', aliases: [], is_followed: true,
    last_scanned_at: '2026-11-05T00:00:00Z', created_at: '2026-11-04T00:00:00Z' }
  const candidate = { id: 'match', story_id: 'story', video_id: demoVideos[1].id,
    status: 'pending' as const, score: 95, reason: 'Nome da obra; mesmo canal.',
    detected_at: '2026-11-05T00:00:00Z', decided_at: null, video: demoVideos[1] }
  const view = storiesView({ data: { groups: [{ story, seed: demoVideos[0],
    confirmed: [], pending: [candidate] }], pendingCount: 1 },
  onDecide: (_item, status) => events.push(status),
  onRename: () => events.push('rename'), onUnfollow: () => events.push('unfollow') })
  assert.equal(view.querySelector('script'), null)
  assert.match(view.textContent ?? '', /Obra <Nova>/)
  assert.equal(view.querySelectorAll('.follow-grid').length, 1)
  assert.equal(view.querySelectorAll('.follow-card').length, 1)
  assert.equal(view.querySelectorAll('.follow-hero').length, 1)
  assert.equal(view.querySelectorAll('.follow-video').length, 2)
  assert.match(view.textContent ?? '', /Possíveis continuações \(1\)/)
  assert.equal(view.querySelector('.follow-sequence')?.hasAttribute('hidden'), true)

  view.querySelector<HTMLButtonElement>('.follow-expand')!.click()
  assert.equal(view.querySelector('.follow-sequence')?.hasAttribute('hidden'), false)

  view.querySelector<HTMLButtonElement>('.follow-rename')!.click()
  view.querySelector<HTMLButtonElement>('.follow-controls button')!.click()

  const decisions = view.querySelectorAll<HTMLButtonElement>(
    '.follow-candidate-actions button'
  )
  decisions[0].click()
  decisions[1].click()

  assert.deepEqual(events, ['rename', 'unfollow', 'confirmed', 'rejected'])
  assert.match(sidebarView('stories', true, 1).textContent ?? '', /Minhas histórias \(1\)/)
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
    onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onLoadMore: () => {},
    onFollow: () => {}, trackedVideoIds: new Set()
  })
  const titles = [...view.querySelectorAll('.video-card h2')].map((title) => title.textContent)
  assert.deepEqual(titles, ['Amora', 'Zebra'])
  assert.match(view.textContent ?? '', /Vídeos favoritos2/)
}))

test('Todos os lançamentos e Todos os canais exibem só o último vídeo de cada canal', () => withDocument(() => {
  const latest = { ...demoVideos[0], id: 'newest', published_at: '2026-11-05T12:00:00Z' }
  const older = { ...demoVideos[0], id: 'older', published_at: '2026-11-01T12:00:00Z' }
  const other = { ...demoVideos[1], id: 'other', published_at: '2026-11-04T12:00:00Z' }
  const base = { mode: 'videos' as const, sort: 'recent' as const,
    videos: [latest, older, other], highlights: [latest, other], channels: demoChannels,
    filter: { query: '', status: 'all' as const, channelId: '' }, hasMore: true,
    onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onLoadMore: () => {},
    onFollow: () => {}, trackedVideoIds: new Set<string>() }
  const view = videoView(base)
  assert.equal(view.querySelectorAll('.video-card').length, 2)
  assert.equal(view.querySelector('.load-more'), null)
  assert.deepEqual([...view.querySelectorAll('.video-card h2')].map((node) => node.textContent),
    [latest.title, other.title])
  const byChannel = videoView({ ...base, filter: { ...base.filter, channelId: demoChannelIds[0] } })
  assert.equal(byChannel.querySelectorAll('.video-card').length, 2)
  assert.notEqual(byChannel.querySelector('.load-more'), null)
}))

test('favoritos fora da primeira página são exibidos sem carregar mais', () => withDocument(() => {
  const favorite = { ...demoVideos[1], id: 'favorite-from-old-page',
    state: { video_id: 'favorite-from-old-page', is_favorite: true, is_watched: true } }
  const view = videoView({
    mode: 'favorites', sort: 'recent', channels: demoChannels,
    videos: [demoVideos[0]], favoriteVideos: [favorite], hasMore: true,
    filter: { query: '', status: 'all', channelId: '' },
    onFilter: () => {}, onSort: () => {}, onToggle: () => {}, onLoadMore: () => {},
    onFollow: () => {}, trackedVideoIds: new Set()
  })
  assert.equal(view.querySelectorAll('.video-card').length, 1)
  assert.match(view.textContent ?? '', /Experimentos que cabem na mesa/)
  assert.equal(view.querySelector('.load-more'), null)
  assert.match(view.textContent ?? '', /Vídeos favoritos1/)
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
