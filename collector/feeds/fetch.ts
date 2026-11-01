import { parseFeed, type ParsedFeed } from './parse.ts'

const timeoutMs = 10000
const maxBytes = 1_000_000

export async function fetchFeed(channelId: string): Promise<ParsedFeed> {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error('ID de canal inválido.')
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'RePlay/1.0 (+https://github.com/angeline1986/replay)' }
      })
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`RSS HTTP ${response.status}`)
      }
      if (!response.ok) throw new Error(`RSS HTTP ${response.status}`)
      if (Number(response.headers.get('content-length')) > maxBytes) {
        throw new Error('RSS excede o limite de tamanho.')
      }
      const xml = await response.text()
      if (xml.length > maxBytes) throw new Error('RSS excede o limite de tamanho.')
      return parseFeed(xml, channelId)
    } catch (error) {
      lastError = error
      const retryable = error instanceof TypeError || error instanceof DOMException ||
        /^RSS HTTP (429|5\d\d)$/.test(String(error instanceof Error ? error.message : error))
      if (!retryable || attempt === 2) break
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida no RSS.')
}
