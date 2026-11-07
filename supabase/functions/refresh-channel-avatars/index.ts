import { withSupabase } from 'npm:@supabase/server@1.9.2'

interface ChannelRow { id: string; youtube_channel_id: string }
interface YouTubeChannel { id?: string; snippet?: { thumbnails?: {
  default?: { url?: string }; medium?: { url?: string }; high?: { url?: string }
} } }

function apiKey(): string | undefined {
  return (globalThis as typeof globalThis & {
    Deno: { env: { get(name: string): string | undefined } }
  }).Deno.env.get('YOUTUBE_API_KEY')
}

async function readAvatars(ids: string[], key: string): Promise<Map<string, string>> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('id', ids.join(','))
  url.searchParams.set('maxResults', String(ids.length))
  url.searchParams.set('key', key)
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('YouTube API indisponível.')
  const data = await response.json() as { items?: YouTubeChannel[] }
  const result = new Map<string, string>()
  for (const item of data.items ?? []) {
    const url = item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url
    if (item.id && url?.startsWith('https://')) result.set(item.id, url)
  }
  return result
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 })
    const ownerId = ctx.userClaims?.id
    if (!ownerId) return Response.json({ error: 'Não autenticado.' }, { status: 401 })
    const { data: owner, error: ownerError } = await ctx.supabase.from('profiles')
      .select('role').eq('user_id', ownerId).single()
    if (ownerError || owner?.role !== 'owner') {
      return Response.json({ error: 'Acesso não autorizado.' }, { status: 403 })
    }
    const key = apiKey()
    const db = ctx.supabaseAdmin
    if (!key || !db) return Response.json({ error: 'Backend não configurado.' }, { status: 503 })
    const { data: channels, error } = await db.from('channels')
      .select('id,youtube_channel_id').eq('owner_id', ownerId).is('avatar_url', null).limit(100)
    if (error || !channels) return Response.json({ error: 'Falha ao consultar canais.' }, { status: 503 })
    let refreshed = 0
    try {
      for (let start = 0; start < channels.length; start += 50) {
        const batch = channels.slice(start, start + 50) as ChannelRow[]
        const avatars = await readAvatars(batch.map((channel) => channel.youtube_channel_id), key)
        for (const channel of batch) {
          const avatar = avatars.get(channel.youtube_channel_id)
          if (!avatar) continue
          const saved = await db.from('channels').update({ avatar_url: avatar })
            .eq('id', channel.id).eq('owner_id', ownerId).is('avatar_url', null).select('id')
          if (saved.error) throw new Error('Falha ao salvar imagens.')
          refreshed += saved.data?.length ?? 0
        }
      }
    } catch {
      return Response.json({ error: 'Não foi possível atualizar as imagens dos canais.' }, { status: 502 })
    }
    return Response.json({ refreshed, remaining: channels.length - refreshed })
  })
}
