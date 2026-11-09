export interface Channel {
  id: string
  owner_id: string
  youtube_channel_id: string
  handle: string | null
  name: string
  avatar_url: string | null
  is_active: boolean
  is_top: boolean
  last_checked_at: string | null
  last_success_at: string | null
}

export interface Video {
  id: string
  channel_id: string
  youtube_video_id: string
  title: string
  url: string
  thumbnail_url: string
  published_at: string
  discovered_at: string
  channel?: Pick<Channel, 'name' | 'id'>
  state?: VideoState
  external?: true
}

export interface VideoState {
  video_id: string
  is_favorite: boolean
  is_watched: boolean
  is_deprioritized?: boolean
  is_queued?: boolean
  queued_at?: string | null
}

export interface ChannelRequest {
  id: string
  handle: string
  status: 'pending' | 'resolved' | 'error'
  error_message: string | null
}

export interface VideoFilter {
  query: string
  status: 'all' | 'new' | 'unwatched' | 'favorites' | 'marked'
  channelId: string
}

export function filterVideos(videos: Video[], filter: VideoFilter): Video[] {
  const query = filter.query.toLocaleLowerCase('pt-BR').trim()
  return videos.filter((video) => {
    if (filter.channelId && video.channel_id !== filter.channelId) return false
    if (filter.status === 'favorites' && !video.state?.is_favorite) return false
    if (filter.status === 'marked' && !video.state?.is_favorite && !video.state?.is_watched &&
      !video.state?.is_queued && !video.state?.is_deprioritized) return false
    if (filter.status === 'unwatched' && video.state?.is_watched) return false
    if (filter.status === 'new' && video.state) return false
    const text = video.title.toLocaleLowerCase('pt-BR')
    return text.includes(query)
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
}

export function validVideoUrl(id: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('ID de vídeo inválido')
  return `https://www.youtube.com/watch?v=${id}`
}

export function validChannelId(id: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(id)
}
