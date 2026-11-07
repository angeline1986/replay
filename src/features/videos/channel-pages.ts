import type { Video } from '../../shared/model.ts'

interface Page {
  offset: number
  buffer: Video[]
  extra: Video[]
  exhausted: boolean
}

const BATCH = 20

export class ChannelPages {
  private pages = new Map<string, Page>()

  reset(): void { this.pages.clear() }

  hasMore(channelId: string): boolean {
    const page = this.pages.get(channelId)
    return !page || page.buffer.length > 0 || !page.exhausted
  }

  videos(base: Video[], channelId: string): Video[] {
    if (!channelId) return base
    const seen = new Set(base.map((video) => video.id))
    const extra = (this.pages.get(channelId)?.extra ?? []).filter((video) => {
      if (seen.has(video.id)) return false
      seen.add(video.id)
      return true
    })
    return [...base, ...extra]
  }

  async load(
    channelId: string, base: Video[],
    fetchPage: (offset: number, limit: number) => Promise<Video[]>
  ): Promise<void> {
    const page = this.pages.get(channelId) ?? {
      offset: 0, buffer: [], extra: [], exhausted: false
    }
    const seen = new Set([...base, ...page.extra].map((video) => video.id))
    let added = 0
    // Reserva um quinto vídeo elegível para saber se o botão deve continuar.
    let available = false
    while (added < 4 || !available) {
      if (!page.buffer.length) {
        if (page.exhausted) break
        const fetched = await fetchPage(page.offset, BATCH)
        page.offset += fetched.length
        page.buffer.push(...fetched)
        if (fetched.length < BATCH) page.exhausted = true
        if (!fetched.length) break
      }
      const candidate = page.buffer[0]
      if (seen.has(candidate.id)) {
        page.buffer.shift()
      } else if (added === 4) {
        available = true
      } else {
        page.buffer.shift()
        page.extra.push(candidate)
        seen.add(candidate.id)
        added++
      }
    }
    this.pages.set(channelId, page)
  }
}

export async function loadNext(
  channelId: string, videos: Video[], hasMore: boolean, pages: ChannelPages,
  fetchPage: (offset: number, limit: number, channelId?: string) => Promise<Video[]>
): Promise<boolean> {
  if (channelId) {
    await pages.load(channelId, videos, (offset, limit) => fetchPage(offset, limit, channelId))
    return hasMore
  }
  const next = await fetchPage(videos.length, 5)
  videos.push(...next.slice(0, 4))
  return next.length > 4
}
