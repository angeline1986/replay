import { ApiBudget, MAX_ACTIVE_CHANNELS, MAX_PAGES_PER_CHANNEL, youtubeGet } from './client.ts'

export interface Video {
  youtube_video_id: string
  title: string
  url: string
  thumbnail_url: string
  published_at: string
  youtube_updated_at: null
}

export interface Uploads { videos: Video[] }

interface ChannelResponse {
  items?: Array<{ id?: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
}

interface PlaylistResponse {
  nextPageToken?: string
  items?: Array<{
    contentDetails?: { videoId?: string; videoPublishedAt?: string }
    snippet?: { title?: string; videoOwnerChannelId?: string }
    status?: { privacyStatus?: string }
  }>
}

const channelPattern = /^UC[A-Za-z0-9_-]{22}$/
const videoPattern = /^[A-Za-z0-9_-]{11}$/

export async function uploadPlaylists(
  channelIds: string[], key: string, budget: ApiBudget, fetcher: typeof fetch = fetch
): Promise<Map<string, string>> {
  const unique = [...new Set(channelIds)]
  if (unique.length > MAX_ACTIVE_CHANNELS) throw new Error('Limite de 100 canais ativos excedido.')
  if (unique.some((id) => !channelPattern.test(id))) throw new Error('ID de canal inválido.')
  const playlists = new Map<string, string>()
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50)
    const response = await youtubeGet<ChannelResponse>('channels', {
      part: 'contentDetails', id: batch.join(','), maxResults: '50'
    }, key, budget, fetcher)
    if (!Array.isArray(response.items)) throw new Error('Resposta de canais inválida.')
    for (const item of response.items) {
      const playlist = item.contentDetails?.relatedPlaylists?.uploads
      if (item.id && batch.includes(item.id) && playlist) playlists.set(item.id, playlist)
    }
  }
  return playlists
}

export async function fetchUploads(
  playlistId: string, channelId: string, key: string, budget: ApiBudget,
  fetcher: typeof fetch = fetch
): Promise<Uploads> {
  if (!playlistId || !channelPattern.test(channelId)) throw new Error('Playlist ou canal inválido.')
  const videos = new Map<string, Video>()
  let pageToken = ''
  const seenTokens = new Set<string>()
  for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page++) {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails,status', playlistId, maxResults: '50'
    }
    if (pageToken) params.pageToken = pageToken
    const response = await youtubeGet<PlaylistResponse>('playlistItems', params, key, budget, fetcher)
    if (!Array.isArray(response.items)) throw new Error('Resposta da playlist inválida.')
    for (const item of response.items) {
      const id = item.contentDetails?.videoId
      const title = item.snippet?.title?.trim()
      const published = item.contentDetails?.videoPublishedAt
      if (item.status?.privacyStatus !== 'public' || !id || !videoPattern.test(id) ||
        !title || /^(Deleted video|Private video)$/i.test(title) ||
        !published || !Number.isFinite(Date.parse(published)) ||
        (item.snippet?.videoOwnerChannelId && item.snippet.videoOwnerChannelId !== channelId)) continue
      videos.set(id, {
        youtube_video_id: id, title: title.slice(0, 500),
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        published_at: new Date(published).toISOString(), youtube_updated_at: null
      })
    }
    const next = response.nextPageToken
    if (!next) break
    if (seenTokens.has(next)) throw new Error('Paginação repetida da playlist.')
    seenTokens.add(next)
    pageToken = next
  }
  return { videos: [...videos.values()] }
}
