import assert from 'node:assert/strict'
import test from 'node:test'
import { importOne } from '../../supabase/functions/import-channel/import-one.ts'
import { youtube } from '../../supabase/functions/import-channel/youtube.ts'

const channelId = 'UC' + 'a'.repeat(22)
const originalChannel = youtube.channel
const originalUploads = youtube.uploads
const previousDeno = (globalThis as any).Deno

function mockDB(found: any, records: any[]) {
  const db = { from(table: string) {
    if (table === 'channels') return {
      select(_cols: string, opts?: object) {
        if (opts) return { eq() { return { eq: async () => ({ count: 0, error: null }) } } }
        return { eq() { return { eq() { return {
          maybeSingle: async () => ({ data: found, error: null })
        } } } } }
      },
      upsert(payload: any) {
        records.push({ table: 'channels', kind: 'upsert', payload })
        return { select() { return { single: async () => ({
          data: { id: 'db-channel', youtube_channel_id: channelId }, error: null
        }) } } }
      },
      update(payload: any) {
        records.push({ table: 'channels', kind: 'update', payload })
        return { eq: async () => ({ error: null }) }
      }
    }
    if (table === 'videos') return { upsert(payload: any) {
      records.push({ table: 'videos', kind: 'upsert', payload })
      return { select: async () => ({ data: [{ id: 'db-video' }], error: null }) }
    } }
    throw new Error(`Unexpected table ${table}`)
  } }
  return db
}

async function withMock<T>(work: () => Promise<T>): Promise<T> {
  ;(globalThis as any).Deno = { env: { get: () => 'test-key' } }
  youtube.channel = async () => ({ id: channelId, name: 'Novo canal', avatar: null,
    playlist: 'UU' + 'a'.repeat(22) })
  youtube.uploads = async () => [{ youtube_video_id: '12345678901', title: 'Video',
    url: 'https://www.youtube.com/watch?v=12345678901',
    thumbnail_url: 'https://i.ytimg.com/vi/12345678901/hqdefault.jpg',
    published_at: '2026-11-07T00:00:00Z', youtube_updated_at: null }]
  try { return await work() }
  finally {
    youtube.channel = originalChannel
    youtube.uploads = originalUploads
    ;(globalThis as any).Deno = previousDeno
  }
}

test('canal novo: maybeSingle null permite cadastrar e importar', async () => withMock(async () => {
  const records: any[] = []
  const result = await importOne(mockDB(null, records), 'owner-test', { handle: 'NovoCanal' })
  assert.equal(result.status, 'imported')
  assert.equal(result.importedVideos, 1)
  assert.deepEqual(records.map((r) => r.table), ['channels', 'videos', 'channels'])
}))

test('canal ja importado: evita escrita e coleta repetida', async () => withMock(async () => {
  const records: any[] = []
  const result = await importOne(mockDB({ id: 'old-id', youtube_channel_id: channelId,
    last_success_at: '2026-11-06T00:00:00Z' }, records), 'owner-test', { handle: 'NovoCanal' })
  assert.equal(result.status, 'already_monitored')
  assert.equal(result.importedVideos, 0)
  assert.deepEqual(records, [])
}))

test('retry incompleto reutiliza canal sem reativacao automatica', async () => withMock(async () => {
  const records: any[] = []
  const result = await importOne(mockDB({ id: 'old-id', youtube_channel_id: channelId,
    last_success_at: null }, records), 'owner-test', { handle: 'NovoCanal' })
  assert.equal(result.status, 'imported')
  assert.equal(records.some((r) => r.kind === 'upsert' && r.table === 'channels'), false)
}))
