import type { SupabaseClient } from '@supabase/supabase-js'
import { videoId } from '../../supabase/functions/lookup-youtube-video/input.ts'
import type { YouTubeLookupResult } from './saved-youtube.ts'

export type LookupCollection = 'queue' | 'deprioritized' | 'completed' | 'favorites' | 'stories'

export async function localYouTubeVideo(
  db: SupabaseClient, userId: string, input: string, collection: LookupCollection
): Promise<YouTubeLookupResult | null> {
  const id = videoId(input)
  if (!id) throw new Error('Cole um link válido de vídeo do YouTube.')
  const saved = await db.from('saved_youtube_videos')
    .select('youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at,is_queued,is_deprioritized')
    .eq('user_id', userId).eq('youtube_video_id', id).maybeSingle()
  if (saved.error) throw new Error(saved.error.message)
  const savedResult: YouTubeLookupResult | null = saved.data ? {
    youtube_video_id: id, youtube_channel_id: saved.data.youtube_channel_id,
    channel_name: saved.data.channel_name, title: saved.data.title,
    thumbnail_url: saved.data.thumbnail_url, published_at: saved.data.published_at,
    already_added: collection === 'queue' ? saved.data.is_queued
      : collection === 'deprioritized' ? saved.data.is_deprioritized : false,
    from_replay: true
  } : null
  if (savedResult?.already_added) return savedResult
  const stored = await db.from('videos')
    .select('id,channel_id,title,thumbnail_url,published_at')
    .eq('youtube_video_id', id).limit(1).maybeSingle()
  if (stored.error) throw new Error(stored.error.message)
  if (!stored.data) return savedResult
  const channel = await db.from('channels').select('youtube_channel_id,name')
    .eq('id', stored.data.channel_id).maybeSingle()
  if (channel.error) throw new Error(channel.error.message)
  if (!channel.data) throw new Error('Canal do vídeo não encontrado no RePlay.')
  let alreadyAdded = false
  if (collection === 'completed') {
    const story = await db.from('tracked_stories').select('id').eq('owner_id', userId)
      .eq('seed_video_id', stored.data.id).not('completed_at', 'is', null).limit(1).maybeSingle()
    if (story.error) throw new Error(story.error.message)
    alreadyAdded = Boolean(story.data)
  } else if (collection !== 'stories') {
    const state = await db.from('user_video_state').select('is_queued,is_deprioritized,is_favorite')
      .eq('user_id', userId).eq('video_id', stored.data.id).maybeSingle()
    if (state.error) throw new Error(state.error.message)
    alreadyAdded = Boolean(collection === 'queue' ? state.data?.is_queued
      : collection === 'deprioritized' ? state.data?.is_deprioritized : state.data?.is_favorite)
  }
  return {
    youtube_video_id: id, youtube_channel_id: channel.data.youtube_channel_id,
    channel_name: channel.data.name, title: stored.data.title,
    thumbnail_url: stored.data.thumbnail_url, published_at: stored.data.published_at,
    already_added: alreadyAdded, from_replay: true
  }
}
