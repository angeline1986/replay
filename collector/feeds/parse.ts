import { XMLParser, XMLValidator } from 'fast-xml-parser'

export interface FeedVideo {
  youtube_video_id: string
  title: string
  url: string
  thumbnail_url: string
  published_at: string
  youtube_updated_at: string | null
}

export interface ParsedFeed {
  name: string | null
  videos: FeedVideo[]
}

interface Entry {
  'yt:videoId'?: string
  'yt:channelId'?: string
  title?: string
  published?: string
  updated?: string
}

function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Data ${field} inválida no RSS.`)
  }
  return new Date(value).toISOString()
}

export function parseFeed(xml: string, expectedChannelId: string): ParsedFeed {
  if (XMLValidator.validate(xml) !== true) throw new Error('XML inválido no RSS.')
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })
  const feed = parser.parse(xml)?.feed
  if (!feed || typeof feed !== 'object') throw new Error('RSS sem feed Atom.')
  if (feed['yt:channelId'] !== expectedChannelId) throw new Error('RSS pertence a outro canal.')
  const entries: Entry[] = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : []
  const unique = new Map<string, FeedVideo>()
  for (const entry of entries) {
    const id = entry['yt:videoId']
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('ID de vídeo inválido no RSS.')
    if (entry['yt:channelId'] !== expectedChannelId) throw new Error('Vídeo pertence a outro canal.')
    if (typeof entry.title !== 'string' || !entry.title.trim()) throw new Error('Título ausente no RSS.')
    unique.set(id, {
      youtube_video_id: id,
      title: entry.title.slice(0, 500),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published_at: date(entry.published, 'published'),
      youtube_updated_at: entry.updated ? date(entry.updated, 'updated') : null
    })
  }
  const name = typeof feed.title === 'string' ? feed.title.trim().slice(0, 200) : ''
  return { name: name || null, videos: [...unique.values()] }
}
