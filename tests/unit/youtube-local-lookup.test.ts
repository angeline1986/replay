import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupYouTube } from '../../src/shared/saved-youtube.ts'

const id = 'Hx2SPzq2h4Q'
const channelId = 'UC' + 'a'.repeat(22)
const metadata = { youtube_video_id: id, youtube_channel_id: channelId,
  channel_name: 'Canal local', title: 'Vídeo local', thumbnail_url: 'https://i.ytimg.com/vi/Hx2SPzq2h4Q/hqdefault.jpg',
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

test('vídeo já salvo na fila usa o banco e não consulta YouTube', async () => {
  const { db, calls } = fakeDb({ saved_youtube_videos: { ...metadata, is_queued: true,
    is_deprioritized: false } })
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}&t=2s`, 'queue')
  assert.equal(result.title, metadata.title)
  assert.equal(result.already_added, true)
  assert.deepEqual(calls, ['saved_youtube_videos'])
})

test('vídeo importado usa metadados e estado locais', async () => {
  const { db, calls } = fakeDb({ videos: { id: 'video-1', channel_id: 'channel-1',
    title: metadata.title, thumbnail_url: metadata.thumbnail_url, published_at: metadata.published_at },
  channels: { youtube_channel_id: channelId, name: metadata.channel_name },
  user_video_state: { is_queued: false, is_deprioritized: true } })
  const result = await lookupYouTube(db, 'owner', `https://youtu.be/${id}`, 'deprioritized')
  assert.equal(result.youtube_channel_id, channelId)
  assert.equal(result.already_added, true)
  assert.deepEqual(calls, ['saved_youtube_videos', 'videos', 'channels', 'user_video_state'])
})

test('classificação do vídeo importado prevalece sobre registro separado antigo', async () => {
  const { db, calls } = fakeDb({ saved_youtube_videos: { ...metadata,
    is_queued: false, is_deprioritized: false },
  videos: { id: 'video-1', channel_id: 'channel-1', title: metadata.title,
    thumbnail_url: metadata.thumbnail_url, published_at: metadata.published_at },
  channels: { youtube_channel_id: channelId, name: metadata.channel_name },
  user_video_state: { is_queued: true, is_deprioritized: false } })
  const result = await lookupYouTube(db, 'owner', id, 'queue')
  assert.equal(result.already_added, true)
  assert.equal(calls.includes('youtube'), false)
})

test('Concluídos reconhece história existente sem chamada externa', async () => {
  const { db, calls } = fakeDb({ videos: { id: 'video-1', channel_id: 'channel-1',
    title: metadata.title, thumbnail_url: metadata.thumbnail_url, published_at: metadata.published_at },
  channels: { youtube_channel_id: channelId, name: metadata.channel_name },
  tracked_stories: { id: 'story-1' } })
  const result = await lookupYouTube(db, 'owner', id, 'completed')
  assert.equal(result.already_added, true)
  assert.equal(calls.includes('youtube'), false)
})

test('vídeo ausente usa YouTube; link inválido não consome API nem consulta o banco', async () => {
  const { db, calls } = fakeDb({})
  const result = await lookupYouTube(db, 'owner', `https://www.youtube.com/watch?v=${id}`, 'queue')
  assert.equal(result.youtube_video_id, id)
  assert.deepEqual(calls, ['saved_youtube_videos', 'videos', 'youtube'])
  calls.length = 0
  await assert.rejects(lookupYouTube(db, 'owner', 'https://youtube.com.evil.test/watch?v=Hx2SPzq2h4Q',
    'queue'), /link válido/)
  assert.deepEqual(calls, [])
})
