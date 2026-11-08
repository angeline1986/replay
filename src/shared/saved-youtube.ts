import type { SupabaseClient } from '@supabase/supabase-js'
import type { Video } from './model.ts'

export interface YouTubeResult {
  youtube_video_id: string
  youtube_channel_id: string
  channel_name: string
  title: string
  thumbnail_url: string
  published_at: string
}

interface SavedVideo extends YouTubeResult {
  id: string
  is_queued: boolean
  is_deprioritized: boolean
}

const fields = 'id,youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at,is_queued,is_deprioritized'

function asVideo(row: SavedVideo): Video {
  return {
    id: row.id, channel_id: row.youtube_channel_id, youtube_video_id: row.youtube_video_id,
    title: row.title, url: `https://www.youtube.com/watch?v=${row.youtube_video_id}`,
    thumbnail_url: row.thumbnail_url, published_at: row.published_at, discovered_at: row.published_at,
    channel: { id: row.youtube_channel_id, name: row.channel_name }, external: true,
    state: { video_id: row.id, is_favorite: false, is_watched: false,
      is_queued: row.is_queued, is_deprioritized: row.is_deprioritized }
  }
}

export async function loadSavedYouTube(db: SupabaseClient, userId: string): Promise<Video[]> {
  const rows: SavedVideo[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('saved_youtube_videos').select(fields)
      .eq('user_id', userId).or('is_queued.eq.true,is_deprioritized.eq.true')
      .order('published_at', { ascending: false }).range(offset, offset + 499)
    if (error) throw new Error(error.message)
    rows.push(...(data as SavedVideo[]))
    if (!data || data.length < 500) break
  }
  return rows.map(asVideo)
}

export async function lookupYouTube(db: SupabaseClient, input: string): Promise<YouTubeResult> {
  const { data, error } = await db.functions.invoke<YouTubeResult>('lookup-youtube-video', {
    body: { url: input }
  })
  if (error) {
    const context = error.context as Response | undefined
    const body = context && 'json' in context ? await context.json().catch(() => null) : null
    throw new Error(body?.error ?? error.message)
  }
  if (!data?.youtube_video_id || !data.title) throw new Error('Resposta inválida do YouTube.')
  return data
}

export async function saveYouTubeToCollection(
  db: SupabaseClient, userId: string, video: YouTubeResult, flag: 'is_queued' | 'is_deprioritized'
): Promise<void> {
  const monitored = await db.from('videos').select('id').eq('youtube_video_id', video.youtube_video_id)
    .limit(1).maybeSingle()
  if (monitored.error) throw new Error(monitored.error.message)
  if (monitored.data) {
    const current = await db.from('user_video_state')
      .select('is_favorite,is_watched,is_deprioritized,is_queued,watched_at')
      .eq('user_id', userId).eq('video_id', monitored.data.id).maybeSingle()
    if (current.error) throw new Error(current.error.message)
    const { error } = await db.from('user_video_state').upsert({
      user_id: userId, video_id: monitored.data.id,
      is_favorite: current.data?.is_favorite ?? false, is_watched: current.data?.is_watched ?? false,
      watched_at: current.data?.watched_at ?? null,
      is_deprioritized: current.data?.is_deprioritized ?? false,
      is_queued: current.data?.is_queued ?? false, [flag]: true
    }, { onConflict: 'user_id,video_id' })
    if (error) throw new Error(error.message)
    return
  }
  const current = await db.from('saved_youtube_videos').select('is_queued,is_deprioritized')
    .eq('user_id', userId).eq('youtube_video_id', video.youtube_video_id).maybeSingle()
  if (current.error) throw new Error(current.error.message)
  const { error } = await db.from('saved_youtube_videos').upsert({
    ...video, user_id: userId, is_queued: current.data?.is_queued ?? false,
    is_deprioritized: current.data?.is_deprioritized ?? false, [flag]: true
  }, { onConflict: 'user_id,youtube_video_id' })
  if (error) throw new Error(error.message)
}

export async function toggleSavedYouTube(
  db: SupabaseClient, video: Video, flag: 'is_queued' | 'is_deprioritized'
): Promise<void> {
  const next = !video.state?.[flag]
  const { error } = await db.from('saved_youtube_videos').update({ [flag]: next }).eq('id', video.id)
  if (error) throw new Error(error.message)
}
