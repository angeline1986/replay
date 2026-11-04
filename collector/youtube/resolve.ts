import { ApiBudget, youtubeGet } from './client.ts'

const channelPattern = /^UC[A-Za-z0-9_-]{22}$/

export interface ResolvedChannel {
  youtube_channel_id: string
  name: string
  avatar_url: string | null
}

export async function resolveHandle(handle: string, apiKey: string): Promise<ResolvedChannel> {
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(handle)) throw new Error('Handle inválido.')
  const data = await youtubeGet<{
    items?: Array<{ id?: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>
  }>('channels', { part: 'snippet', forHandle: handle }, apiKey, new ApiBudget(1))
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
