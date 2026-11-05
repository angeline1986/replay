import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Channel, ChannelRequest, Video, VideoState } from './model.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configured = Boolean(url && key)
export const supabase: SupabaseClient | null = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase ainda não configurado.')
  return supabase
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Resposta vazia do servidor.')
  return result.data
}

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  const session = await client().auth.getSession()
  if (session.error) throw new Error(session.error.message)
  if (!session.data.session) return null
  const { data, error } = await client().auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) return null
  const result = await client().from('profiles').select('user_id').eq('user_id', data.user.id).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  const profile = result.data
  if (!profile) {
    await signOut()
    throw new Error('Seu e-mail ainda não está autorizado no RePlay.')
  }
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut({ scope: 'local' })
  if (error) throw new Error(error.message)
}

export async function sendMagicLink(email: string): Promise<void> {
  const redirectTo = `${location.origin}/replay/`
  const { error } = await client().auth.signInWithOtp({
    email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
  })
  if (error) throw new Error(error.message)
}

export async function signInWithGitHub(): Promise<void> {
  const redirectTo = `${location.origin}/replay/`
  const { error } = await client().auth.signInWithOAuth({
    provider: 'github', options: { redirectTo }
  })
  if (error) throw new Error(error.message)
}

export async function loadDashboard(userId: string): Promise<{
  channels: Channel[]; requests: ChannelRequest[]; videos: Video[]; hasMore: boolean
}> {
  const channels = unwrap(await client().from('channels').select('*').order('name')) as Channel[]
  const requests = unwrap(await client().from('channel_requests')
    .select('id,handle,status,error_message').order('created_at', { ascending: false }).limit(20)) as ChannelRequest[]
  const videos = await loadVideoPage(userId, channels, 0)
  return { channels, requests, videos, hasMore: videos.length === 50 }
}

export async function loadVideoPage(userId: string, channels: Channel[], offset: number): Promise<Video[]> {
  const videos = unwrap(await client().from('videos')
    .select('id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at')
    .order('published_at', { ascending: false }).range(offset, offset + 49)) as Video[]
  if (!videos.length) return []
  const states = unwrap(await client().from('user_video_state')
    .select('video_id,is_favorite,is_watched').eq('user_id', userId)
    .in('video_id', videos.map((video) => video.id))) as VideoState[]
  const byChannel = new Map(channels.map((item) => [item.id, item]))
  const byVideo = new Map(states.map((item) => [item.video_id, item]))
  return videos.map((video) => ({
    ...video,
    channel: byChannel.get(video.channel_id),
    state: byVideo.get(video.id)
  }))
}

export async function requestChannel(userId: string, handle: string): Promise<void> {
  const { error } = await client().from('channel_requests').insert({ owner_id: userId, handle })
  if (error) throw new Error(error.message)
}

export async function saveVideoState(userId: string, video: Video): Promise<void> {
  const state = video.state ?? { video_id: video.id, is_favorite: false, is_watched: false }
  const { error } = await client().from('user_video_state').upsert({
    user_id: userId, video_id: video.id,
    is_favorite: state.is_favorite, is_watched: state.is_watched,
    watched_at: state.is_watched ? new Date().toISOString() : null
  }, { onConflict: 'user_id,video_id' })
  if (error) throw new Error(error.message)
}

export async function addChannel(userId: string, channelId: string): Promise<void> {
  const { error } = await client().from('channels').insert({
    owner_id: userId, youtube_channel_id: channelId,
    name: channelId, is_active: true
  })
  if (error) throw new Error(error.message)
}

export async function removeChannel(channel: Channel): Promise<void> {
  const { error } = await client().from('channels').delete().eq('id', channel.id)
  if (error) throw new Error(error.message)
}
