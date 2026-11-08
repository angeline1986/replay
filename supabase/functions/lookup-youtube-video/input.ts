export function videoId(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 500) return null
  const value = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  let id = ''
  if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.slice(1)
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v') ?? ''
    else if (/^\/(shorts|live|embed)\//.test(url.pathname)) id = url.pathname.split('/')[2] ?? ''
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}
