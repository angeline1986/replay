import type { SupabaseClient } from '@supabase/supabase-js'
import { validVideoUrl, type Video } from './model.ts'
import { saveYouTubeToCollection } from './saved-youtube.ts'

export async function promoteSavedVideo(
  db: SupabaseClient, userId: string, video: Video,
  importChannel?: (input: { id: string }) => Promise<unknown>
): Promise<Video> {
  if (!video.external) return video
  let channel = await db.from('channels').select('id').eq('owner_id', userId)
    .eq('youtube_channel_id', video.channel_id).maybeSingle()
  if (channel.error) throw new Error(channel.error.message)
  if (!channel.data && importChannel) {
    await importChannel({ id: video.channel_id })
    channel = await db.from('channels').select('id').eq('owner_id', userId)
      .eq('youtube_channel_id', video.channel_id).maybeSingle()
  }
  if (channel.error) throw new Error(channel.error.message)
  if (!channel.data) throw new Error('Cadastre o canal para classificar este vídeo.')
  const stored = await db.from('videos').select('id').eq('channel_id', channel.data.id)
    .eq('youtube_video_id', video.youtube_video_id).maybeSingle()
  if (stored.error) throw new Error(stored.error.message)
  let storedId: string | undefined = stored.data?.id
  if (!storedId) {
    const result = await db.functions.invoke<{ video_id?: string }>('lookup-youtube-video', {
      body: { url: validVideoUrl(video.youtube_video_id), save: true }
    })
    if (result.error) throw new Error('Não foi possível preparar o vídeo salvo.')
    if (!result.data?.video_id) throw new Error('Vídeo salvo não encontrado.')
    storedId = result.data.video_id
  }
  const flag = video.state?.is_queued ? 'is_queued' : video.state?.is_deprioritized ? 'is_deprioritized' : null
  if (flag) await saveYouTubeToCollection(db, userId, {
    youtube_video_id: video.youtube_video_id, youtube_channel_id: video.channel_id,
    channel_name: video.channel?.name ?? 'Canal', title: video.title,
    thumbnail_url: video.thumbnail_url, published_at: video.published_at
  }, flag)
  const state = await db.from('user_video_state')
    .select('is_favorite,is_watched,is_queued,is_deprioritized,queued_at,deprioritized_at').eq('user_id', userId)
    .eq('video_id', storedId).maybeSingle()
  if (state.error) throw new Error(state.error.message)
  return { ...video, id: storedId, channel_id: channel.data.id, external: undefined,
    state: { video_id: storedId, is_favorite: Boolean(state.data?.is_favorite),
      is_watched: Boolean(state.data?.is_watched), is_queued: Boolean(state.data?.is_queued),
      is_deprioritized: Boolean(state.data?.is_deprioritized), queued_at: state.data?.queued_at,
      deprioritized_at: state.data?.deprioritized_at } }
}
