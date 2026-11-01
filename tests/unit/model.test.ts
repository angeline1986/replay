import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeChannelInput } from '../../src/features/channels/normalize.ts'
import { filterVideos, validChannelId, validVideoUrl, type Video } from '../../src/shared/model.ts'

const id = 'UC1234567890123456789012'
const videos: Video[] = [
  {
    id: 'one', channel_id: 'c1', youtube_video_id: 'abcdefghijk', title: 'Primeiro vídeo',
    url: validVideoUrl('abcdefghijk'), thumbnail_url: '',
    published_at: '2026-10-30T10:00:00Z', discovered_at: '2026-10-30T10:00:00Z',
    channel: { id: 'c1', name: 'Ateliê' }
  },
  {
    id: 'two', channel_id: 'c2', youtube_video_id: 'lmnopqrstuv', title: 'Segundo',
    url: validVideoUrl('lmnopqrstuv'), thumbnail_url: '',
    published_at: '2026-10-31T10:00:00Z', discovered_at: '2026-10-31T10:00:00Z',
    channel: { id: 'c2', name: 'Ciência' },
    state: { video_id: 'two', is_favorite: true, is_watched: true }
  }
]

test('normaliza ID, URL e arroba sem inventar ID', () => {
  assert.deepEqual(normalizeChannelInput(id), { id })
  assert.deepEqual(normalizeChannelInput(`https://www.youtube.com/channel/${id}`), { id })
  assert.deepEqual(normalizeChannelInput('@canal'), { handle: 'canal' })
  assert.equal(validChannelId(id), true)
  assert.equal(validChannelId('bad'), false)
})

test('rejeita host falso, protocolo inseguro e URL sem canal', () => {
  assert.throws(() => normalizeChannelInput(`https://youtube.com.evil.test/channel/${id}`), /HTTPS do YouTube/)
  assert.throws(() => normalizeChannelInput(`http://youtube.com/channel/${id}`), /HTTPS do YouTube/)
  assert.throws(() => normalizeChannelInput('https://youtube.com/watch?v=abc'), /URL sem ID/)
})

test('filtra e ordena vídeos por canal, texto e estado', () => {
  const base = { query: '', channelId: '', status: 'all' as const }
  assert.deepEqual(filterVideos(videos, base).map((video) => video.id), ['two', 'one'])
  assert.deepEqual(filterVideos(videos, { ...base, channelId: 'c1' }).map((video) => video.id), ['one'])
  assert.deepEqual(filterVideos(videos, { ...base, query: 'ATELIÊ' }).map((video) => video.id), ['one'])
  assert.deepEqual(filterVideos(videos, { ...base, status: 'favorites' }).map((video) => video.id), ['two'])
  assert.deepEqual(filterVideos(videos, { ...base, status: 'unwatched' }).map((video) => video.id), ['one'])
  assert.deepEqual(filterVideos(videos, { ...base, status: 'new' }).map((video) => video.id), ['one'])
})

test('não transforma ID de vídeo malicioso em link', () => {
  assert.throws(() => validVideoUrl('javascript:'), /inválido/)
})
