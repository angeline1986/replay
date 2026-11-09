import type { SupabaseClient } from '@supabase/supabase-js'
import { videoId } from '../../supabase/functions/lookup-youtube-video/input.ts'
import type { Channel, Video, VideoState } from './model.ts'
import { saveCompletedYouTube, type YouTubeResult } from './saved-youtube.ts'
import { importChannelNow } from './import-channel.ts'
import { promoteSavedVideo } from './promote-saved-video.ts'

const videoFields = 'id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at'
const stateFields = 'video_id,is_favorite,is_watched,is_deprioritized,is_queued,queued_at,favorited_at,deprioritized_at'
const savedFields = 'id,youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at,is_queued,is_deprioritized,queued_at,deprioritized_at'

interface SavedRow {
  id: string; youtube_video_id: string; youtube_channel_id: string; channel_name: string
  title: string; thumbnail_url: string; published_at: string; is_queued: boolean
  is_deprioritized: boolean; queued_at: string | null; deprioritized_at: string | null
}

function asSavedVideo(row: SavedRow): Video {
  return { id: row.id, channel_id: row.youtube_channel_id,
    youtube_video_id: row.youtube_video_id, title: row.title,
    url: `https://www.youtube.com/watch?v=${row.youtube_video_id}`,
    thumbnail_url: row.thumbnail_url, published_at: row.published_at, discovered_at: row.published_at,
    channel: { id: row.youtube_channel_id, name: row.channel_name }, external: true,
    state: { video_id: row.id, is_favorite: false, is_watched: false,
      is_queued: row.is_queued, is_deprioritized: row.is_deprioritized,
      queued_at: row.queued_at, deprioritized_at: row.deprioritized_at } }
}

export async function findReplayVideos(
  db: SupabaseClient, userId: string, input: string, channels: Channel[]
): Promise<Video[]> {
  const term = input.trim().slice(0, 120)
  if (term.length < 2) throw new Error('Digite pelo menos dois caracteres.')
  const id = videoId(term)
  const title = term.replace(/[%_\\]/g, '')
  if (!id && title.length < 2) throw new Error('Digite pelo menos dois caracteres do título.')
  const query = db.from('videos').select(videoFields)
  const savedQuery = db.from('saved_youtube_videos').select(savedFields).eq('user_id', userId)
  const [found, saved] = await Promise.all([
    id ? query.eq('youtube_video_id', id).limit(1)
      : query.ilike('title', `%${title}%`).order('published_at', { ascending: false }).limit(20),
    id ? savedQuery.eq('youtube_video_id', id).limit(1)
      : savedQuery.ilike('title', `%${title}%`).order('published_at', { ascending: false }).limit(20)
  ])
  if (found.error) throw new Error(found.error.message)
  if (saved.error) throw new Error(saved.error.message)
  const videos = (found.data ?? []) as Video[]
  const states = videos.length ? await db.from('user_video_state').select(stateFields)
    .eq('user_id', userId).in('video_id', videos.map((video) => video.id)) : null
  if (states?.error) throw new Error(states.error.message)
  const byState = new Map(((states?.data ?? []) as VideoState[]).map((state) => [state.video_id, state]))
  const byChannel = new Map(channels.map((channel) => [channel.id, channel]))
  const monitored = videos.map((video) => ({ ...video,
    channel: byChannel.get(video.channel_id), state: byState.get(video.id) }))
  const seen = new Set(videos.map((video) => video.youtube_video_id))
  const external = ((saved.data ?? []) as SavedRow[]).filter((row) => !seen.has(row.youtube_video_id))
    .map(asSavedVideo)
  return [...monitored, ...external].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 20)
}

export async function storeFoundYouTubeVideo(
  db: SupabaseClient, userId: string, result: YouTubeResult, channels: Channel[]
): Promise<Video> {
  const saved = await db.from('saved_youtube_videos').select(savedFields)
    .eq('user_id', userId).eq('youtube_video_id', result.youtube_video_id).maybeSingle()
  if (saved.error) throw new Error(saved.error.message)
  if (saved.data) return promoteSavedVideo(db, userId, asSavedVideo(saved.data as SavedRow), importChannelNow)
  const id = await saveCompletedYouTube(db, userId, result, importChannelNow)
  const [video, state] = await Promise.all([
    db.from('videos').select(videoFields).eq('id', id).single(),
    db.from('user_video_state').select(stateFields).eq('user_id', userId)
      .eq('video_id', id).maybeSingle()
  ])
  if (video.error) throw new Error(video.error.message)
  if (state.error) throw new Error(state.error.message)
  if (!video.data) throw new Error('Vídeo não encontrado após salvar.')
  const stored = video.data as Video
  return { ...stored, state: state.data as VideoState | undefined,
    channel: channels.find((channel) => channel.id === stored.channel_id)
      ?? { id: stored.channel_id, name: result.channel_name } }
}
