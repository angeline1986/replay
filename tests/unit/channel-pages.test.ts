import assert from 'node:assert/strict'
import test from 'node:test'
import { ChannelPages, loadNext } from '../../src/features/videos/channel-pages.ts'
import type { Video } from '../../src/shared/model.ts'

function video(n: number, channel: string): Video {
  return {
    id: `${channel}-${n}`, channel_id: channel,
    youtube_video_id: 'abcdefghijk', title: `Vídeo ${n}`,
    url: '', thumbnail_url: '', published_at: new Date(2026, 0, 1, 0, 0, n).toISOString(),
    discovered_at: ''
  }
}

test('canal selecionado acrescenta quatro, quatro e três, com offset independente', async () => {
  const pages = new ChannelPages()
  const fox = Array.from({ length: 14 }, (_, i) => video(i, 'fox'))
  const base = [...fox.slice(0, 3), video(0, 'outro')]
  const offsets: number[] = []
  const fetchPage = async (offset: number, limit: number) => {
    offsets.push(offset)
    assert.equal(limit, 20)
    return fox.slice(offset, offset + limit)
  }
  for (const expected of [7, 11, 14]) {
    await pages.load('fox', base, fetchPage)
    assert.equal(pages.videos(base, 'fox').filter(v => v.channel_id === 'fox').length, expected)
  }
  assert.deepEqual(offsets, [0])
  assert.equal(pages.hasMore('fox'), false)
  assert.equal(new Set(pages.videos(base, 'fox').map(v => v.id)).size, 15)
})

test('paginação do canal inicia do zero mesmo com só alguns vídeos nos 50 gerais', async () => {
  const pages = new ChannelPages()
  const fox = Array.from({ length: 31 }, (_, i) => video(i, 'fox'))
  const base = [fox[0], fox[1], fox[2], video(0, 'outro')]
  const offsets: number[] = []
  const fetchPage = async (offset: number, limit: number) => {
    offsets.push(offset)
    return fox.slice(offset, offset + limit)
  }
  for (let i = 0; i < 6; i++) await pages.load('fox', base, fetchPage)
  assert.deepEqual(offsets, [0, 20])
  assert.equal(pages.videos(base, 'fox').filter(v => v.channel_id === 'fox').length, 27)
  assert.equal(pages.hasMore('fox'), true)
})

test('paginação independente por canal e sem alterar os 50 iniciais', async () => {
  const pages = new ChannelPages()
  const base = [video(0, 'fox'), video(0, 'outro')]
  const original = base.slice()
  for (const channel of ['fox', 'outro']) {
    const data = Array.from({ length: 6 }, (_, i) => video(i, channel))
    await pages.load(channel, base, async (offset, limit) => data.slice(offset, offset + limit))
    assert.equal(pages.videos(base, channel).filter(v => v.channel_id === channel).length, 5)
  }
  assert.deepEqual(base, original)
  assert.equal(pages.videos(base, '').length, 2)
  pages.reset()
  assert.equal(pages.videos(base, 'fox').length, 2)
})

test('paginação geral mantém +4 e não aplica filtro por canal', async () => {
  const pages = new ChannelPages()
  const base = Array.from({ length: 50 }, (_, i) => video(i, 'a'))
  const next = Array.from({ length: 5 }, (_, i) => video(i + 50, 'b'))
  const more = await loadNext('', base, true, pages, async (offset, limit, channelId) => {
    assert.equal(offset, 50)
    assert.equal(limit, 5)
    assert.equal(channelId, undefined)
    return next
  })
  assert.equal(base.length, 54)
  assert.equal(more, true)
})

test('falha de rede não perde o cursor já armazenado', async () => {
  const pages = new ChannelPages()
  const base = [video(0, 'fox')]
  await assert.rejects(
    pages.load('fox', base, async () => { throw new Error('network') }),
    /network/
  )
  assert.equal(pages.hasMore('fox'), true)
  assert.equal(pages.videos(base, 'fox').length, 1)
})
