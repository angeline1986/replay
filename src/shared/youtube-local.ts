import type { SupabaseClient } from '@supabase/supabase-js'
import { videoId } from '../../supabase/functions/lookup-youtube-video/input.ts'
import type { YouTubeLookupResult } from './saved-youtube.ts'

export async function localYouTubeVideo(
  db: SupabaseClient, userId: string, input: string
): Promise<YouTubeLookupResult | null> {
  const id = videoId(input)
  if (!id) throw new Error('Cole um link válido de vídeo do YouTube.')
  const saved = await db.from('saved_youtube_videos')
    .select('youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at')
    .eq('user_id', userId).eq('youtube_video_id', id).maybeSingle()
  if (saved.error) throw new Error(saved.error.message)
  if (saved.data) return {
    youtube_video_id: id, youtube_channel_id: saved.data.youtube_channel_id,
    channel_name: saved.data.channel_name, title: saved.data.title,
    thumbnail_url: saved.data.thumbnail_url, published_at: saved.data.published_at,
    already_added: true
  }
  const stored = await db.from('videos')
    .select('id,channel_id,title,thumbnail_url,published_at')
    .eq('youtube_video_id', id).limit(1).maybeSingle()
  if (stored.error) throw new Error(stored.error.message)
  if (!stored.data) return null
  const channel = await db.from('channels').select('youtube_channel_id,name')
    .eq('id', stored.data.channel_id).maybeSingle()
  if (channel.error) throw new Error(channel.error.message)
  if (!channel.data) throw new Error('Canal do vídeo não encontrado no RePlay.')
  return {
    youtube_video_id: id, youtube_channel_id: channel.data.youtube_channel_id,
    channel_name: channel.data.name, title: stored.data.title,
    thumbnail_url: stored.data.thumbnail_url, published_at: stored.data.published_at,
    already_added: true
  }
}
