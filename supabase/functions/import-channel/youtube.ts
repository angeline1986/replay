interface Input { handle?: string; channelId?: string }
interface ChannelResponse {
  items?: Array<{ id?: string; snippet?: { title?: string; thumbnails?: {
    default?: { url?: string } } }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
}
interface PlaylistResponse {
  nextPageToken?: string
  items?: Array<{ contentDetails?: { videoId?: string; videoPublishedAt?: string },
    snippet?: { title?: string; videoOwnerChannelId?: string },
    status?: { privacyStatus?: string } }>
}

async function get<T>(type: string, key: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${type}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', key)
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) {
    if ([403, 429].includes(response.status)) throw new Error('Cota YouTube indisponível.')
    throw new Error(`YouTube API HTTP ${response.status}.`)
  }
  return await response.json() as T
}

export const youtube = {
  async channel(key: string, input: Input) {
    const data = await get<ChannelResponse>('channels', key, {
      part: 'snippet,contentDetails', ...(input.handle ? { forHandle: input.handle } : { id: input.channelId! })
    })
    const item = data.items?.[0]
    const id = item?.id
    const name = item?.snippet?.title?.trim()
    const playlist = item?.contentDetails?.relatedPlaylists?.uploads
    if (!id || !/^UC[A-Za-z0-9_-]{22}$/.test(id) || !name || !playlist) {
      throw new Error('Canal não encontrado ou sem playlist pública.')
    }
    const avatar = item?.snippet?.thumbnails?.default?.url ?? null
    return { id, name: name.slice(0, 200), playlist,
      avatar: avatar?.startsWith('https://') ? avatar : null }
  },
  async uploads(key: string, channelId: string, playlist: string) {
    const videos = new Map<string, {
      youtube_video_id: string; title: string; url: string; thumbnail_url: string;
      published_at: string; youtube_updated_at: null
    }>()
    let token = ''
    const seenTokens = new Set<string>()
    for (let i = 0; i < 1; i++) {
      const data = await get<PlaylistResponse>('playlistItems', key, {
        part: 'snippet,contentDetails,status', playlistId: playlist, maxResults: '50',
        ...(token ? { pageToken: token } : {})
      })
      if (!Array.isArray(data.items)) throw new Error('Playlist inválida.')
      for (const item of data.items) {
        const id = item.contentDetails?.videoId
        const title = item.snippet?.title?.trim()
        const published = item.contentDetails?.videoPublishedAt
        if (item.status?.privacyStatus !== 'public' || !id || !/^[A-Za-z0-9_-]{11}$/.test(id) ||
          !title || !published || !Number.isFinite(Date.parse(published)) ||
          (item.snippet?.videoOwnerChannelId && item.snippet.videoOwnerChannelId !== channelId)) continue
        videos.set(id, { youtube_video_id: id, title: title.slice(0, 500),
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          published_at: new Date(published).toISOString(), youtube_updated_at: null })
      }
      const next = data.nextPageToken
      if (!next) break
      if (seenTokens.has(next)) throw new Error('Paginação repetida da playlist.')
      seenTokens.add(next)
      token = next
    }
    return [...videos.values()]
  }
}
