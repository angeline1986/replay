import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JSDOM } from 'jsdom'
import { loadClassifiedChannelVideos } from '../../src/shared/video-collections.ts'
import { saveCompletedYouTube } from '../../src/shared/saved-youtube.ts'
import { channelView } from '../../src/features/channels/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'

test('vídeos marcados incluem favoritos e vídeos externos da fila, sem misturar canais', async () => {
  const rows = [
    { video_id: 'demo-v1', is_favorite: true, is_watched: false },
    { video_id: 'demo-v2', is_favorite: false, is_watched: true }
  ]
  const saved = { id: 'saved-v3', youtube_video_id: 'ccccccccccc',
    youtube_channel_id: demoChannels[0].youtube_channel_id, channel_name: demoChannels[0].name,
    title: 'Vídeo da fila', thumbnail_url: '', published_at: '2026-01-01T00:00:00Z',
    is_queued: true, is_deprioritized: false }
  let selectedChannel = ''
  const db = { from: (table: string) => {
    const query = {
      select: () => query,
      eq: (field: string, value: string) => { if (field === 'channel_id') selectedChannel = value; return query },
      or: () => query,
      order: () => query,
      range: () => ({ data: table === 'saved_youtube_videos' ? [saved] : rows, error: null }),
      in: () => Promise.resolve({ data: demoVideos.filter((video) => video.channel_id === selectedChannel), error: null })
    }
    assert.ok(['user_video_state', 'videos', 'saved_youtube_videos'].includes(table))
    return query
  } } as unknown as SupabaseClient
  const videos = await loadClassifiedChannelVideos(db, 'owner', demoChannels[0])
  assert.deepEqual(videos.map((video) => video.id), ['demo-v1', 'saved-v3'])
  assert.equal(videos[0].state?.is_favorite, true)
  assert.equal(videos[1].state?.is_queued, true)
})

test('botão do cartão abre os vídeos marcados do canal correto', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const opened: string[] = []
    const view = channelView({ channels: demoChannels, requests: [], videos: demoVideos,
      onAdd: () => {}, onToggle: () => {}, onTop: () => {}, onRemove: () => {}, onOpen: () => {},
      onMarked: (channel) => opened.push(channel.id) })
    const cards = view.querySelectorAll('.channel-card')
    cards[1].querySelector<HTMLButtonElement>('.channel-marked-videos')!.click()
    assert.deepEqual(opened, [demoChannels[1].id])
    const youtube = cards[1].querySelector<HTMLAnchorElement>('.channel-avatar-link')!
    assert.equal(youtube.hostname, 'www.youtube.com')
    assert.equal(youtube.getAttribute('aria-label'), `Ver ${demoChannels[1].name} no YouTube`)
    const youtubeShortcut = cards[1].querySelector<HTMLAnchorElement>('.channel-youtube-link')!
    assert.equal(youtubeShortcut.href, youtube.href)
    assert.match(youtubeShortcut.querySelector<HTMLElement>('.channel-shortcut-icon')?.style.maskImage ?? '',
      /youtube-brands-solid-full\.svg/)
    assert.match(cards[1].querySelector<HTMLElement>('.channel-marked-videos .channel-shortcut-icon')?.style.maskImage ?? '',
      /thumbtack-solid-full\.svg/)
    assert.doesNotMatch(cards[1].textContent ?? '', /\+\d+ novos?/)
    assert.equal(cards[0].querySelectorAll(':scope > .channel-card-head, :scope > .channel-card-status, :scope > .channel-card-actions').length, 3)
  } finally { globalThis.document = original; dom.window.close() }
})

test('adicionar vídeo concluído importa canal ausente e salva ID verificado', async () => {
  const calls: string[] = []
  const video = { youtube_video_id: 'aaaaaaaaaaa', youtube_channel_id: 'UC0000000000000000000000',
    channel_name: 'Canal', title: 'História', thumbnail_url: '', published_at: '2026-11-08T00:00:00Z' }
  const db = {
    from: () => {
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: null, error: null }) }
      return query
    },
    functions: { invoke: async (name: string, args: { body: { url: string; save: boolean } }) => {
      calls.push(`${name}:${args.body.save}:${args.body.url}`)
      return { data: { video_id: '11111111-1111-1111-1111-111111111111' }, error: null }
    } }
  } as unknown as SupabaseClient
  const id = await saveCompletedYouTube(db, 'owner', video, async (input) => { calls.push(`import:${input.id}`) })
  assert.equal(id, '11111111-1111-1111-1111-111111111111')
  assert.deepEqual(calls, [
    `import:${video.youtube_channel_id}`,
    'lookup-youtube-video:true:https://www.youtube.com/watch?v=aaaaaaaaaaa'
  ])
})

test('vídeo já importado entra em Concluídos sem consultar YouTube novamente', async () => {
  const calls: string[] = []
  const db = { from: (table: string) => {
    calls.push(table)
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: table === 'channels' ? { id: 'channel-1' }
        : { id: '11111111-1111-1111-1111-111111111111' }, error: null }) }
    return query
  }, functions: { invoke: async () => { calls.push('youtube'); return { data: null, error: null } } }
  } as unknown as SupabaseClient
  const video = { youtube_video_id: 'aaaaaaaaaaa', youtube_channel_id: 'UC0000000000000000000000',
    channel_name: 'Canal', title: 'História', thumbnail_url: '', published_at: '2026-11-08T00:00:00Z' }
  const id = await saveCompletedYouTube(db, 'owner', video, async () => { calls.push('import') })
  assert.equal(id, '11111111-1111-1111-1111-111111111111')
  assert.deepEqual(calls, ['channels', 'videos'])
})

test('limite de importação impede salvar vídeo concluído de canal novo', async () => {
  let invoked = false
  const db = { from: () => {
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }) }
    return query
  }, functions: { invoke: async () => { invoked = true; return { data: null, error: null } } }
  } as unknown as SupabaseClient
  const video = { youtube_video_id: 'aaaaaaaaaaa', youtube_channel_id: 'UC0000000000000000000000',
    channel_name: 'Canal', title: 'História', thumbnail_url: '', published_at: '2026-11-08T00:00:00Z' }
  await assert.rejects(saveCompletedYouTube(db, 'owner', video, async () => {
    throw new Error('Limite de 12 tentativas diárias')
  }), /12 tentativas/)
  assert.equal(invoked, false)
})
