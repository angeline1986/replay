import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel, Video, VideoState } from './model.ts'
import { loadSavedYouTube } from './saved-youtube.ts'

type CollectionFlag = 'is_favorite' | 'is_deprioritized' | 'is_queued'
const fields = 'video_id,is_favorite,is_watched,is_deprioritized,is_queued,queued_at,favorited_at,deprioritized_at'

function data<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('Resposta vazia do servidor.')
  return result.data
}

export async function loadVideoCollection(
  db: SupabaseClient, userId: string, channels: Channel[], flag: CollectionFlag
): Promise<Video[]> {
  const ids: string[] = []
  for (let offset = 0; ; offset += 500) {
    const rows = data(await db.from('user_video_state').select('video_id')
      .eq('user_id', userId).eq(flag, true).range(offset, offset + 499)) as { video_id: string }[]
    ids.push(...rows.map((row) => row.video_id))
    if (rows.length < 500) break
  }
  const byChannel = new Map(channels.map((channel) => [channel.id, channel]))
  const result: Video[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100)
    const [videos, states] = await Promise.all([
      db.from('videos').select('id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at').in('id', batch),
      db.from('user_video_state').select(fields).eq('user_id', userId).in('video_id', batch)
    ])
    const byVideo = new Map((data(states) as VideoState[]).map((state) => [state.video_id, state]))
    result.push(...(data(videos) as Video[]).map((video) => ({
      ...video, channel: byChannel.get(video.channel_id), state: byVideo.get(video.id)
    })).filter((video) => Boolean(video.state?.[flag])))
  }
  return result.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
}

export async function loadClassifiedChannelVideos(
  db: SupabaseClient, userId: string, channel: Channel
): Promise<Video[]> {
  const states: VideoState[] = []
  for (let offset = 0; ; offset += 500) {
    const rows = data(await db.from('user_video_state').select(fields)
      .eq('user_id', userId)
      .or('is_favorite.eq.true,is_watched.eq.true,is_queued.eq.true,is_deprioritized.eq.true')
      .range(offset, offset + 499)) as VideoState[]
    states.push(...rows)
    if (rows.length < 500) break
  }
  const result: Video[] = []
  for (let offset = 0; offset < states.length; offset += 100) {
    const batch = states.slice(offset, offset + 100)
    const videos = data(await db.from('videos')
      .select('id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at')
      .eq('channel_id', channel.id).in('id', batch.map((item) => item.video_id))) as Video[]
    const byVideo = new Map(batch.map((item) => [item.video_id, item]))
    result.push(...videos.map((video) => ({ ...video, channel, state: byVideo.get(video.id) })))
  }
  const external = (await loadSavedYouTube(db, userId))
    .filter((video) => video.channel_id === channel.youtube_channel_id)
  return [...result, ...external].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
}
