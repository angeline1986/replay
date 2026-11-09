import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupYouTube } from '../../src/shared/saved-youtube.ts'

const id = '3OWy1FHRLMo'
const channelId = 'UC' + 'a'.repeat(22)
const metadata = { youtube_video_id: id, youtube_channel_id: channelId,
  channel_name: 'Momo Manhwa', title: 'Quando o Filho Mais Novo do Duke Reencarna Como O Gênio Assassino!',
  thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  published_at: '2026-11-01T00:00:00Z' }

function fakeDb(rows: Record<string, unknown>) {
  const calls: string[] = []
  const db = {
    from: (table: string) => {
      calls.push(table)
      const query = { select: () => query, eq: () => query, not: () => query, limit: () => query,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }
      return query
    },
    functions: { invoke: async () => { calls.push('youtube'); return { data: metadata, error: null } } }
  } as unknown as SupabaseClient
  return { db, calls }
}

test('vídeo salvo no RePlay pode entrar na fila sem consultar o YouTube', async () => {
  const { db, calls } = fakeDb({ saved_youtube_videos: { ...metadata, is_queued: false,
    is_deprioritized: false } })
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}&t=2s`, 'queue')
  assert.equal(result.title, metadata.title)
  assert.equal(result.already_added, false)
  assert.equal(result.from_replay, true)
  assert.deepEqual(calls, ['saved_youtube_videos', 'videos'])
})

test('link do print é reconhecido pelo vídeo importado mesmo sem is_queued', async () => {
  const { db, calls } = fakeDb({ videos: { id: 'video-1', channel_id: 'channel-1',
    title: metadata.title, thumbnail_url: metadata.thumbnail_url, published_at: metadata.published_at },
  channels: { youtube_channel_id: channelId, name: metadata.channel_name } })
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}&t=1123s`, 'queue')
  assert.equal(result.youtube_channel_id, channelId)
  assert.equal(result.already_added, false)
  assert.equal(result.from_replay, true)
  assert.deepEqual(calls, ['saved_youtube_videos', 'videos', 'channels', 'user_video_state'])
})

test('só bloqueia quando o vídeo já está na fila', async () => {
  const { db, calls } = fakeDb({ videos: { id: 'video-1', channel_id: 'channel-1',
    title: metadata.title, thumbnail_url: metadata.thumbnail_url, published_at: metadata.published_at },
  channels: { youtube_channel_id: channelId, name: metadata.channel_name },
  user_video_state: { is_queued: true, is_deprioritized: false } })
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}`, 'queue')
  assert.equal(result.already_added, true)
  assert.equal(calls.includes('youtube'), false)
})

test('vídeo ausente usa YouTube; link inválido não consome API nem consulta o banco', async () => {
  const { db, calls } = fakeDb({})
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}`, 'queue')
  assert.equal(result.youtube_video_id, id)
  assert.deepEqual(calls, ['saved_youtube_videos', 'videos', 'youtube'])
  calls.length = 0
  await assert.rejects(lookupYouTube(db, 'owner', `https://youtube.com.evil.test/watch?v=${id}`, 'queue'), /link válido/)
  assert.deepEqual(calls, [])
})
