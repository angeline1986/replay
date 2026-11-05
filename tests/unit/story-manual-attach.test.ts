import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { attachStoryVideo } from '../../src/shared/stories-api.ts'

test('associação manual chama RPC restrita com IDs explícitos', async () => {
  const calls: unknown[] = []
  const db = { rpc: async (name: string, params: unknown) => {
    calls.push([name, params]); return { data: 'confirmed', error: null }
  } } as unknown as SupabaseClient
  const result = await attachStoryVideo(db, 'story-a', 'video-b')
  assert.equal(result, 'confirmed')
  assert.deepEqual(calls, [['attach_story_video', {
    p_story_id: 'story-a', p_video_id: 'video-b'
  }]])
})

test('associação manual não mascara rejeições do banco', async () => {
  const db = { rpc: async () => ({ data: null, error: {
    message: 'Esta sugestão foi rejeitada e não pode ser reaberta.'
  } }) } as unknown as SupabaseClient
  await assert.rejects(attachStoryVideo(db, 's', 'v'), /rejeitada/)
})

test('associação manual rejeita resposta inesperada', async () => {
  const db = { rpc: async () => ({ data: 'pending', error: null }) } as unknown as SupabaseClient
  await assert.rejects(attachStoryVideo(db, 's', 'v'), /não confirmada/)
})
