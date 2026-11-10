import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { channelView } from '../../src/features/channels/view.ts'
import { storiesView } from '../../src/features/stories/view.ts'
import { followStory, loadStoryDashboard, setStoryCompleted } from '../../src/shared/stories-api.ts'
import { routeFromHash } from '../../src/app/route.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'
import type { Video } from '../../src/shared/model.ts'
import type { TrackedStory } from '../../src/shared/story-model.ts'

function withDocument(run: (window: JSDOM['window']) => void): void {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try { run(dom.window) }
  finally { globalThis.document = original; dom.window.close() }
}

test('canais tops podem aparecer primeiro ou sozinhos sem mudar a marcação', () => withDocument((window) => {
  const reordered = [
    { ...demoChannels[1], id: 'z', name: 'Zeta' },
    { ...demoChannels[0], id: 'e', name: 'Épico' },
    { ...demoChannels[1], id: 'a', name: 'Álvaro' },
    { ...demoChannels[0], id: 'b', name: 'Bêta' }
  ]
  const selected: string[] = []
  const base = { channels: reordered, requests: [], videos: demoVideos,
    onAdd: () => {}, onToggle: () => {}, onTop: () => {}, onRemove: () => {}, onOpen: () => {}, onMarked: () => {},
    onTopFilter: (value: string) => selected.push(value) }
  const first = channelView({ ...base, topFilter: 'top-first' })
  assert.deepEqual([...first.querySelectorAll('.channel-card h2')].map((node) => node.textContent),
    ['Bêta', 'Épico', 'Álvaro', 'Zeta'])
  const all = channelView({ ...base, topFilter: 'all' })
  assert.deepEqual([...all.querySelectorAll('.channel-card h2')].map((node) => node.textContent),
    ['Álvaro', 'Bêta', 'Épico', 'Zeta'])
  first.querySelector<HTMLButtonElement>('.channel-top-filter .channel-picker-trigger')!.click()
  first.querySelector<HTMLButtonElement>('.channel-top-filter [data-channel-id="top-only"]')!.click()
  assert.deepEqual(selected, ['top-only'])
  const only = channelView({ ...base, topFilter: 'top-only' })
  assert.deepEqual([...only.querySelectorAll('.channel-card h2')].map((node) => node.textContent), ['Bêta', 'Épico'])
  assert.equal(only.querySelector('.favorite-total')?.textContent, '2')
  assert.equal(only.querySelectorAll('.channel-jump .channel-picker-option').length, 3)
  assert.match(only.querySelector<HTMLElement>('.channel-jump .channel-picker-trophy')?.style.maskImage ?? '',
    /trophy-solid-full\.svg/)
  assert.equal(reordered[1].is_top, true)
}))

test('histórias têm filtro, divisores por canal e ações de favorito e visto', () => withDocument((window) => {
  const events: string[] = []
  const selected: string[] = []
  const opened: string[] = []
  const sorted: string[] = []
  const story = (id: string, videoId: string) => ({ id, owner_id: 'owner', seed_video_id: videoId,
    name: `Obra ${id}`, canonical_key: id, aliases: [], is_followed: true, completed_at: null,
    last_scanned_at: null, created_at: '2026-11-04T00:00:00Z' })
  const videos = [
    { ...demoVideos[0], state: { video_id: demoVideos[0].id, is_favorite: true, is_watched: false } },
    { ...demoVideos[1], state: { video_id: demoVideos[1].id, is_favorite: false, is_watched: true } }
  ]
  const options = { channels: demoChannels, selectedChannelId: '', onChannelSelect: (id: string) => selected.push(id),
    query: '', onQuery: () => {}, sort: 'recent' as const, onSort: (value: string) => sorted.push(value), onLookupYouTube: async () => { throw Error('unused') }, onSaveYouTube: () => {},
    data: { groups: videos.map((video, index) => ({ story: story(`s${index}`, video.id), seed: video,
      confirmed: [], pending: [] })), completed: [], pendingCount: 0 },
    onOpenSequence: (story: TrackedStory) => opened.push(story.id), onComplete: () => {},
    onToggleVideo: (video: Video, key: string) => events.push(`${video.id}:${key}`) }
  const view = storiesView(options)
  assert.equal(view.querySelector('.favorite-channel-filter .channel-picker-trigger')?.textContent, 'Canais')
  assert.deepEqual([...view.querySelectorAll('.favorite-channel-heading h3')].map((node) => node.textContent),
    demoChannels.map((channel) => channel.name))
  assert.ok(view.querySelector('.favorite-channel-filter .channel-picker-trophy'))
  assert.equal(view.querySelectorAll('.favorite-channel-group .follow-grid').length, 2)
  const first = view.querySelector('.follow-card')!
  const buttons = [...first.querySelectorAll<HTMLButtonElement>('.follow-tags .icon-action')]
  assert.deepEqual(buttons.map((node) => node.getAttribute('aria-pressed')), ['true', 'true', 'false', 'false'])
  assert.equal(buttons[3].getAttribute('aria-label'), 'Concluir história')
  buttons.slice(1, 3).forEach((node) => node.click())
  assert.equal(first.querySelector('.follow-expand'), null)
  assert.equal(first.querySelector('.follow-footer'), null)
  assert.deepEqual(events, ['demo-v1:is_favorite', 'demo-v1:is_watched'])
  assert.deepEqual(opened, [])
  view.querySelector<HTMLButtonElement>('[aria-label="Ordenar minhas histórias"]')!.click()
  view.querySelector<HTMLButtonElement>('.favorite-sort [data-channel-id="az"]')!.click()
  assert.deepEqual(sorted, ['az'])
  const select = view.querySelector<HTMLButtonElement>(`.favorite-channel-filter .channel-picker-option[data-channel-id="${demoChannels[1].id}"]`)!
  select.click()
  assert.deepEqual(selected, [demoChannels[1].id])
  const filtered = storiesView({ ...options, selectedChannelId: demoChannels[1].id })
  assert.equal(filtered.querySelectorAll('.follow-card').length, 1)
  assert.equal(filtered.querySelector('.favorite-channel-heading h3')?.textContent, demoChannels[1].name)
  const titled = options.data.groups.map((group, index) => ({ ...group,
    story: { ...group.story, name: index ? 'Abelha' : 'Zebra' } }))
  const alphabetical = storiesView({ ...options, data: { ...options.data, groups: titled }, sort: 'az' })
  assert.deepEqual([...alphabetical.querySelectorAll('.follow-card h2')].map((node) => node.textContent), ['Abelha', 'Zebra'])
  const recent = storiesView({ ...options, data: { ...options.data,
    groups: [...options.data.groups].reverse() }, sort: 'recent' })
  assert.deepEqual([...recent.querySelectorAll('.follow-card h2')].map((node) => node.textContent), ['Obra s0', 'Obra s1'])
}))

test('carregamento de histórias inclui os estados pessoais dos vídeos', async () => {
  const story = { id: 's1', owner_id: 'owner', seed_video_id: 'demo-v1', name: 'Obra',
    canonical_key: 'obra', aliases: [], is_followed: true, completed_at: null, last_scanned_at: null,
    created_at: '2026-11-04T00:00:00Z' }
  const queries: string[] = []
  const rows: Record<string, unknown[]> = {
    tracked_stories: [story, { ...story, id: 's2', seed_video_id: 'demo-v2', is_followed: false,
      completed_at: '2026-11-08T00:00:00Z' }], story_matches: [], videos: demoVideos,
    user_video_state: [{ video_id: 'demo-v1', is_favorite: true, is_watched: true }]
  }
  const db = { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      range: () => ({ data: rows[table], error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: rows[table], error: null })
    }
    queries.push(table)
    return query
  } } as unknown as SupabaseClient
  const result = await loadStoryDashboard(db, 'owner', demoChannels)
  assert.equal(result.groups[0].seed?.state?.is_favorite, true)
  assert.equal(result.groups[0].seed?.state?.is_watched, true)
  assert.equal(result.groups.length, 1)
  assert.equal(result.completed.length, 1)
  assert.equal(result.completed[0].seed?.id, 'demo-v2')
  assert.ok(queries.includes('user_video_state'))
})

test('concluir e retomar persistem acompanhamento e data juntos', async () => {
  const updates: Record<string, unknown>[] = []
  const db = { from: () => ({ update: (fields: Record<string, unknown>) => {
    updates.push(fields)
    const query = { eq: () => query, select: () => Promise.resolve({ data: [{ id: 's1' }], error: null }) }
    return query
  } }) } as unknown as SupabaseClient
  await setStoryCompleted(db, 'owner', 's1', true)
  await setStoryCompleted(db, 'owner', 's1', false)
  assert.equal(updates[0].is_followed, false)
  assert.match(String(updates[0].completed_at), /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(updates[1], { is_followed: true, completed_at: null })
})

test('acompanhar novamente limpa a conclusão anterior', async () => {
  let updated: Record<string, unknown> | null = null
  const db = { from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { id: 's1', is_followed: false }, error: null
    }) }) }) }),
    update: (fields: Record<string, unknown>) => {
      updated = fields
      const query = { eq: () => query, select: () => ({ single: async () => ({ data: { id: 's1' }, error: null }) }) }
      return query
    }
  }) } as unknown as SupabaseClient
  const result = await followStory(db, 'owner', 'demo-v1', 'Uma obra distinta', [])
  assert.deepEqual(result, { id: 's1', existing: true })
  assert.deepEqual(updated, { is_followed: true, completed_at: null })
})

test('página Concluídos mostra apenas histórias encerradas e permite retomar', () => withDocument(() => {
  const completedAt = '2026-11-08T00:00:00Z'
  const story = { id: 's1', owner_id: 'owner', seed_video_id: demoVideos[0].id,
    name: 'Obra concluída', canonical_key: 'obra concluida', aliases: [],
    is_followed: false, completed_at: completedAt, last_scanned_at: null,
    created_at: completedAt }
  const resumed: string[] = []
  const options = { mode: 'completed' as const, channels: demoChannels,
    selectedChannelId: '', onChannelSelect: () => {}, query: '', onQuery: () => {}, sort: 'recent', onSort: () => {},
    onLookupYouTube: async () => { throw Error('unused') }, onSaveYouTube: () => {},
    data: { groups: [], completed: [{ story, seed: demoVideos[0], confirmed: [], pending: [] }], pendingCount: 0 },
    onOpenSequence: () => {}, onToggleVideo: () => {},
    onComplete: (item: TrackedStory, completed: boolean) => resumed.push(`${item.id}:${completed}`) }
  const view = storiesView({ ...options, sort: 'recent' })
  assert.equal(view.querySelector('.favorite-channel-filter .channel-picker-trigger')?.textContent, 'Canais')
  assert.equal(routeFromHash('#completed').page, 'completed')
  assert.match(view.textContent ?? '', /Concluídos/)
  assert.equal(view.querySelectorAll('.follow-card').length, 1)
  assert.ok(view.querySelector('.favorite-sort [aria-label="Ordenar histórias concluídas"]'))
  assert.ok(view.querySelector('input[aria-label="Buscar histórias concluídas"]'))
  assert.ok(view.querySelector('input[aria-label="Link de vídeo do YouTube"]'))
  assert.equal(view.querySelector('.follow-tag'), null)
  assert.equal(view.querySelector('.follow-complete'), null)
  const completeIcon = view.querySelector<HTMLElement>('.follow-video-actions .icon-check-double')!
  assert.equal(completeIcon.getAttribute('aria-pressed'), 'true')
  assert.match(completeIcon.querySelector<HTMLElement>('.supplied-svg-icon')?.style.maskImage ?? '', /check-double-solid-full\.svg/)
  view.querySelector<HTMLButtonElement>('.follow-video-actions .icon-runner')!.click()
  assert.deepEqual(resumed, ['s1:false'])
  assert.equal(storiesView({ ...options, query: 'sem correspondência', sort: 'recent' }).querySelectorAll('.follow-card').length, 0)
  const other = { ...story, id: 's2', seed_video_id: demoVideos[1].id,
    name: 'A outra obra', completed_at: '2026-11-07T00:00:00Z' }
  const data = { ...options.data, completed: [...options.data.completed,
    { story: other, seed: demoVideos[1], confirmed: [], pending: [] }] }
  const sorted = storiesView({ ...options, data, sort: 'az' })
  assert.deepEqual([...sorted.querySelectorAll('.follow-card h2')].map((node) => node.textContent),
    ['A outra obra', 'Obra concluída'])
  const byChannel = storiesView({ ...options, data, selectedChannelId: demoChannels[1].id, sort: 'recent' })
  assert.equal(byChannel.querySelectorAll('.follow-card').length, 1)
}))
