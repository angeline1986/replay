import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addYouTubeWithChannel, saveYouTubeToCollection, type YouTubeResult } from '../../src/shared/saved-youtube.ts'

const video: YouTubeResult = {
  youtube_video_id: 'Hx2SPzq2h4Q', youtube_channel_id: 'UC' + 'a'.repeat(22),
  channel_name: 'Canal público', title: 'Vídeo público',
  thumbnail_url: 'https://i.ytimg.com/vi/Hx2SPzq2h4Q/hqdefault.jpg',
  published_at: '2026-11-01T00:00:00Z'
}

function channelDb(exists: boolean) {
  const filters: Record<string, string> = {}
  const query = {
    select: () => query,
    eq: (field: string, value: string) => { filters[field] = value; return query },
    maybeSingle: async () => ({ data: exists ? { id: 'channel-1' } : null, error: null })
  }
  const db = { from: (table: string) => {
    assert.equal(table, 'channels')
    return query
  } } as unknown as SupabaseClient
  return { db, filters }
}

test('canal ausente é importado antes de salvar o vídeo escolhido', async () => {
  const { db, filters } = channelDb(false)
  const steps: string[] = []
  await addYouTubeWithChannel(db, 'owner-1', video, 'is_queued', async (input) => {
    assert.deepEqual(input, { id: video.youtube_channel_id })
    steps.push('importar')
  }, async (_db, _owner, _video, flag) => {
    assert.equal(flag, 'is_queued')
    steps.push('salvar')
  })
  assert.deepEqual(steps, ['importar', 'salvar'])
  assert.deepEqual(filters, { owner_id: 'owner-1', youtube_channel_id: video.youtube_channel_id })
})

test('canal já monitorado não consome nova tentativa de importação', async () => {
  const { db } = channelDb(true)
  let imported = false
  let saved = false
  await addYouTubeWithChannel(db, 'owner-1', video, 'is_deprioritized', async () => {
    imported = true
  }, async () => { saved = true })
  assert.equal(imported, false)
  assert.equal(saved, true)
})

test('falha no cadastro não grava o vídeo como se o canal tivesse sido importado', async () => {
  const { db } = channelDb(false)
  let saved = false
  await assert.rejects(addYouTubeWithChannel(db, 'owner-1', video, 'is_queued',
    async () => { throw new Error('Limite diário') }, async () => { saved = true }), /Limite diário/)
  assert.equal(saved, false)
})

test('vídeo antes salvo separadamente é fundido ao importado sem perder classificações', async () => {
  const saved = { id: 'external-1', is_queued: true, is_deprioritized: false }
  const captured: { state?: Record<string, unknown> } = {}
  let deleted = ''
  function selection(data: unknown) {
    const query = { select: () => query, eq: () => query, limit: () => query,
      maybeSingle: async () => ({ data, error: null }) }
    return query
  }
  const db = { from: (table: string) => {
    if (table === 'videos') return selection({ id: 'monitored-1' })
    if (table === 'saved_youtube_videos') return {
      ...selection(saved), delete: () => ({ eq: async (_field: string, id: string) => {
        deleted = id; return { error: null }
      } })
    }
    if (table === 'user_video_state') return {
      ...selection({ is_favorite: false, is_watched: false, is_queued: false, is_deprioritized: false, watched_at: null }),
      upsert: async (next: Record<string, unknown>) => { captured.state = next; return { error: null } }
    }
    throw new Error(`Tabela inesperada: ${table}`)
  } } as unknown as SupabaseClient
  await saveYouTubeToCollection(db, 'owner-1', video, 'is_deprioritized')
  assert.equal(captured.state?.is_queued, true)
  assert.equal(captured.state?.is_deprioritized, true)
  assert.equal(deleted, 'external-1')
})
