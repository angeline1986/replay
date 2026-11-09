import type { SupabaseClient } from '@supabase/supabase-js'
import { validVideoUrl, type Video } from './model.ts'
import { localYouTubeVideo } from './youtube-local.ts'

export interface YouTubeResult {
  youtube_video_id: string
  youtube_channel_id: string
  channel_name: string
  title: string
  thumbnail_url: string
  published_at: string
}

export interface YouTubeLookupResult extends YouTubeResult {
  already_added?: boolean
  from_replay?: boolean
}

interface SavedVideo extends YouTubeResult {
  id: string
  is_queued: boolean
  is_deprioritized: boolean
  queued_at: string | null
  deprioritized_at: string | null
}

const fields = 'id,youtube_video_id,youtube_channel_id,channel_name,title,thumbnail_url,published_at,is_queued,is_deprioritized,queued_at,deprioritized_at'

function asVideo(row: SavedVideo): Video {
  return {
    id: row.id, channel_id: row.youtube_channel_id, youtube_video_id: row.youtube_video_id,
    title: row.title, url: `https://www.youtube.com/watch?v=${row.youtube_video_id}`,
    thumbnail_url: row.thumbnail_url, published_at: row.published_at, discovered_at: row.published_at,
    channel: { id: row.youtube_channel_id, name: row.channel_name }, external: true,
    state: { video_id: row.id, is_favorite: false, is_watched: false,
      is_queued: row.is_queued, is_deprioritized: row.is_deprioritized,
      queued_at: row.queued_at, deprioritized_at: row.deprioritized_at }
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

export async function lookupYouTube(
  db: SupabaseClient, userId: string, input: string,
  collection: 'queue' | 'deprioritized' | 'completed'
): Promise<YouTubeLookupResult> {
  const local = await localYouTubeVideo(db, userId, input, collection)
  if (local) return local
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

export async function saveCompletedYouTube(
  db: SupabaseClient, userId: string, video: YouTubeResult,
  importChannel: (input: { id: string }) => Promise<unknown>
): Promise<string> {
  const channel = await db.from('channels').select('id').eq('owner_id', userId)
    .eq('youtube_channel_id', video.youtube_channel_id).maybeSingle()
  if (channel.error) throw new Error(channel.error.message)
  if (channel.data) {
    const stored = await db.from('videos').select('id').eq('channel_id', channel.data.id)
      .eq('youtube_video_id', video.youtube_video_id).maybeSingle()
    if (stored.error) throw new Error(stored.error.message)
    if (stored.data) return stored.data.id
  } else await importChannel({ id: video.youtube_channel_id })
  const { data, error } = await db.functions.invoke<{ video_id?: string }>('lookup-youtube-video', {
    body: { url: validVideoUrl(video.youtube_video_id), save: true }
  })
  if (error) {
    const context = error.context as Response | undefined
    const body = context && 'json' in context ? await context.json().catch(() => null) : null
    throw new Error(body?.error ?? error.message)
  }
  if (!data?.video_id || !/^[a-f0-9-]{36}$/i.test(data.video_id)) throw new Error('Vídeo não foi salvo.')
  return data.video_id
}

export async function saveYouTubeToCollection(
  db: SupabaseClient, userId: string, video: YouTubeResult, flag: 'is_queued' | 'is_deprioritized'
): Promise<void> {
  const monitored = await db.from('videos').select('id').eq('youtube_video_id', video.youtube_video_id)
    .limit(1).maybeSingle()
  if (monitored.error) throw new Error(monitored.error.message)
  if (monitored.data) {
    const saved = await db.from('saved_youtube_videos').select('id,is_queued,is_deprioritized,queued_at,deprioritized_at')
      .eq('user_id', userId).eq('youtube_video_id', video.youtube_video_id).maybeSingle()
    if (saved.error) throw new Error(saved.error.message)
    const current = await db.from('user_video_state')
      .select('is_favorite,is_watched,is_deprioritized,is_queued,watched_at,queued_at,deprioritized_at')
      .eq('user_id', userId).eq('video_id', monitored.data.id).maybeSingle()
    if (current.error) throw new Error(current.error.message)
    const { error } = await db.from('user_video_state').upsert({
      user_id: userId, video_id: monitored.data.id,
      is_favorite: current.data?.is_favorite ?? false, is_watched: current.data?.is_watched ?? false,
      watched_at: current.data?.watched_at ?? null,
      is_deprioritized: Boolean(current.data?.is_deprioritized || saved.data?.is_deprioritized),
      is_queued: Boolean(current.data?.is_queued || saved.data?.is_queued), [flag]: true,
      queued_at: current.data?.is_queued ? current.data.queued_at : saved.data?.is_queued
        ? saved.data.queued_at : null,
      deprioritized_at: current.data?.is_deprioritized ? current.data.deprioritized_at
        : saved.data?.is_deprioritized ? saved.data.deprioritized_at : null
    }, { onConflict: 'user_id,video_id' })
    if (error) throw new Error(error.message)
    if (saved.data) {
      const removed = await db.from('saved_youtube_videos').delete().eq('id', saved.data.id)
      if (removed.error) throw new Error(removed.error.message)
    }
    return
  }
  const current = await db.from('saved_youtube_videos').select('is_queued,is_deprioritized,queued_at')
    .eq('user_id', userId).eq('youtube_video_id', video.youtube_video_id).maybeSingle()
  if (current.error) throw new Error(current.error.message)
  const { error } = await db.from('saved_youtube_videos').upsert({
    youtube_video_id: video.youtube_video_id, youtube_channel_id: video.youtube_channel_id,
    channel_name: video.channel_name, title: video.title, thumbnail_url: video.thumbnail_url,
    published_at: video.published_at, user_id: userId, is_queued: current.data?.is_queued ?? false,
    is_deprioritized: current.data?.is_deprioritized ?? false,
    queued_at: current.data?.queued_at ?? null, [flag]: true
  }, { onConflict: 'user_id,youtube_video_id' })
  if (error) throw new Error(error.message)
}

export async function addYouTubeWithChannel(
  db: SupabaseClient, userId: string, video: YouTubeResult,
  flag: 'is_queued' | 'is_deprioritized',
  importChannel: (input: { id: string }) => Promise<unknown>,
  save: typeof saveYouTubeToCollection = saveYouTubeToCollection
): Promise<void> {
  const found = await db.from('channels').select('id').eq('owner_id', userId)
    .eq('youtube_channel_id', video.youtube_channel_id).maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) await importChannel({ id: video.youtube_channel_id })
  await save(db, userId, video, flag)
}

export async function toggleSavedYouTube(
  db: SupabaseClient, video: Video, flag: 'is_queued' | 'is_deprioritized'
): Promise<void> {
  const next = !video.state?.[flag]
  const { error } = await db.from('saved_youtube_videos').update({ [flag]: next }).eq('id', video.id)
  if (error) throw new Error(error.message)
}
