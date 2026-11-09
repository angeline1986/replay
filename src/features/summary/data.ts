import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel, Video, VideoState } from '../../shared/model.ts'

export interface SummaryRow { video: Video; addedAt: string }
export interface SummaryData { rows: SummaryRow[] }

interface StateRow extends VideoState { created_at: string }
interface SavedRow {
  id: string; youtube_video_id: string; youtube_channel_id: string; channel_name: string
  title: string; thumbnail_url: string; published_at: string; created_at: string
  is_queued: boolean; is_deprioritized: boolean
}

export async function loadSummary(
  db: SupabaseClient, userId: string, channels: Channel[]
): Promise<SummaryData> {
  const states: StateRow[] = []
  const saved: SavedRow[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('user_video_state')
      .select('video_id,is_favorite,is_watched,is_queued,is_deprioritized,created_at')
      .eq('user_id', userId).or('is_favorite.eq.true,is_watched.eq.true,is_queued.eq.true,is_deprioritized.eq.true')
      .range(offset, offset + 499)
    if (result.error) throw new Error(result.error.message)
    states.push(...result.data as StateRow[])
    if ((result.data?.length ?? 0) < 500) break
  }
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('saved_youtube_videos')
      .select('id,youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at,created_at,is_queued,is_deprioritized')
      .eq('user_id', userId).or('is_queued.eq.true,is_deprioritized.eq.true')
      .range(offset, offset + 499)
    if (result.error) throw new Error(result.error.message)
    saved.push(...result.data as SavedRow[])
    if ((result.data?.length ?? 0) < 500) break
  }
  const byChannel = new Map(channels.map((channel) => [channel.id, channel]))
  const byState = new Map(states.map((state) => [state.video_id, state]))
  const rows: SummaryRow[] = []
  for (let offset = 0; offset < states.length; offset += 100) {
    const batch = states.slice(offset, offset + 100)
    const result = await db.from('videos')
      .select('id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at')
      .in('id', batch.map((state) => state.video_id))
    if (result.error) throw new Error(result.error.message)
    rows.push(...(result.data as Video[]).map((video) => ({
      video: { ...video, channel: byChannel.get(video.channel_id), state: byState.get(video.id) },
      addedAt: byState.get(video.id)!.created_at
    })))
  }
  const known = new Set(rows.map((row) => row.video.youtube_video_id))
  for (const item of saved) {
    if (known.has(item.youtube_video_id)) continue
    rows.push({
      addedAt: item.created_at,
      video: {
        id: item.id, channel_id: item.youtube_channel_id, youtube_video_id: item.youtube_video_id,
        title: item.title, url: `https://www.youtube.com/watch?v=${item.youtube_video_id}`,
        thumbnail_url: item.thumbnail_url, published_at: item.published_at,
        discovered_at: item.created_at, external: true,
        channel: { id: item.youtube_channel_id, name: item.channel_name },
        state: { video_id: item.id, is_favorite: false, is_watched: false,
          is_queued: item.is_queued, is_deprioritized: item.is_deprioritized }
      }
    })
  }
  return { rows }
}
