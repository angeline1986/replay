import { validChannelId } from '../../shared/model.ts'

export function normalizeChannelInput(input: string): { id?: string; handle?: string } {
  const trimmed = input.trim()
  if (validChannelId(trimmed)) return { id: trimmed }
  if (/^@[\w.-]{3,30}$/.test(trimmed)) return { handle: trimmed.slice(1) }
  let url: URL
  try { url = new URL(trimmed) } catch { throw new Error('Informe um ID UC…, @handle ou URL de canal.') }
  if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    throw new Error('Use uma URL HTTPS do YouTube.')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'channel' && validChannelId(segments[1])) {
    return { id: segments[1] }
  }
  if (segments.length === 1 && /^@[\w.-]{3,30}$/.test(segments[0])) {
    return { handle: segments[0].slice(1) }
  }
  throw new Error('URL sem ID de canal válido. Use /channel/UC… ou @handle.')
}
