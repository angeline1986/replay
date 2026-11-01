const channelPattern = /^UC[A-Za-z0-9_-]{22}$/

export interface ResolvedChannel {
  youtube_channel_id: string
  name: string
  avatar_url: string | null
}

export async function resolveHandle(handle: string, apiKey: string): Promise<ResolvedChannel> {
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(handle)) throw new Error('Handle inválido.')
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('forHandle', handle)
  url.searchParams.set('key', apiKey)
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`)
  const data = await response.json() as {
    items?: Array<{ id?: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>
  }
  const item = data.items?.[0]
  if (!item?.id || !channelPattern.test(item.id) || !item.snippet?.title) {
    throw new Error('Canal não encontrado para o handle informado.')
  }
  const avatar = item.snippet.thumbnails?.default?.url
  return {
    youtube_channel_id: item.id,
    name: item.snippet.title.slice(0, 200),
    avatar_url: avatar?.startsWith('https://') ? avatar : null
  }
}
