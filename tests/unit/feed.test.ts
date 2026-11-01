import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFeed } from '../../collector/feeds/parse.ts'

const channelId = 'UC1234567890123456789012'
const entry = (id: string, title = 'Título &amp; vídeo') => `
  <entry>
    <yt:videoId>${id}</yt:videoId>
    <yt:channelId>${channelId}</yt:channelId>
    <title>${title}</title>
    <published>2026-10-31T10:00:00+00:00</published>
    <updated>2026-10-31T11:00:00+00:00</updated>
  </entry>`
const feed = (body: string) => `<?xml version="1.0"?>
  <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
    <yt:channelId>${channelId}</yt:channelId>${body}
  </feed>`

test('RSS válido extrai vídeo e normaliza datas e URLs', () => {
  const videos = parseFeed(feed(entry('abcdefghijk')), channelId).videos
  assert.equal(videos.length, 1)
  assert.equal(videos[0].title, 'Título & vídeo')
  assert.equal(videos[0].published_at, '2026-10-31T10:00:00.000Z')
  assert.equal(videos[0].url, 'https://www.youtube.com/watch?v=abcdefghijk')
})

test('RSS duplicado mantém um item', () => {
  assert.equal(parseFeed(feed(entry('abcdefghijk') + entry('abcdefghijk')), channelId).videos.length, 1)
})

test('RSS vazio não remove histórico nem gera item', () => {
  assert.deepEqual(parseFeed(feed(''), channelId).videos, [])
})

test('rejeita XML malformado, canal errado, ID e data inválidos', () => {
  assert.throws(() => parseFeed('<feed>', channelId), /XML inválido/)
  assert.throws(() => parseFeed(feed(''), 'UC0000000000000000000000'), /outro canal/)
  assert.throws(() => parseFeed(feed(entry('bad')), channelId), /ID de vídeo/)
  assert.throws(() => parseFeed(feed(entry('abcdefghijk').replace('2026-10-31T10:00:00+00:00', 'bad')), channelId), /Data/)
})
