import { createClient } from '@supabase/supabase-js'
import type { ParsedFeed } from '../feeds/parse.ts'

export interface ActiveChannel {
  id: string
  youtube_channel_id: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false }
})

function assert(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export async function activeChannels(): Promise<ActiveChannel[]> {
  const { data, error } = await db.from('channels').select('id,youtube_channel_id').eq('is_active', true)
  assert(error)
  return data ?? []
}

export async function saveFeed(channel: ActiveChannel, feed: ParsedFeed): Promise<void> {
  const videos = feed.videos
  if (videos.length) {
    const rows = videos.map((video) => ({ ...video, channel_id: channel.id }))
    const { error } = await db.from('videos').upsert(rows, {
      onConflict: 'channel_id,youtube_video_id'
    })
    assert(error)
  }
  const updates: Record<string, string> = {
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString()
  }
  if (feed.name) updates.name = feed.name
  const { error } = await db.from('channels').update(updates).eq('id', channel.id)
  assert(error)
}

export async function recordRun(
  channel: ActiveChannel,
  startedAt: string,
  status: 'success' | 'error',
  count: number,
  errorMessage: string | null
): Promise<void> {
  const now = new Date()
  const { error } = await db.from('sync_runs').insert({
    channel_id: channel.id,
    started_at: startedAt,
    finished_at: now.toISOString(),
    status,
    item_count: count,
    error_message: errorMessage,
    duration_ms: Math.max(0, now.getTime() - Date.parse(startedAt))
  })
  assert(error)
  if (status === 'error') {
    const result = await db.from('channels').update({ last_checked_at: now.toISOString() }).eq('id', channel.id)
    assert(result.error)
  }
}

export async function pruneRuns(): Promise<void> {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await db.from('sync_runs').delete().lt('started_at', threshold)
  assert(error)
}
