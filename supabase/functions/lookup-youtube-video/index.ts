import { withSupabase } from 'npm:@supabase/server@1.9.2'
import { videoId } from './input.ts'

interface VideoResponse {
  items?: Array<{ id?: string; snippet?: {
    title?: string; channelId?: string; channelTitle?: string; publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } }
  }; status?: { privacyStatus?: string } }>
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 })
    if (!ctx.userClaims?.id) return Response.json({ error: 'Não autenticado.' }, { status: 401 })
    const owner = await ctx.supabase.from('profiles').select('role')
      .eq('user_id', ctx.userClaims.id).maybeSingle()
    if (owner.error || owner.data?.role !== 'owner') {
      return Response.json({ error: 'Acesso não autorizado.' }, { status: 403 })
    }
    let body: unknown
    try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }) }
    const input = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).url : null
    const id = videoId(input)
    if (!id) return Response.json({ error: 'Cole um link válido de vídeo do YouTube.' }, { status: 400 })
    const key = Deno.env.get('YOUTUBE_API_KEY')
    if (!key) return Response.json({ error: 'Busca do YouTube não configurada.' }, { status: 503 })
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,status')
    url.searchParams.set('id', id)
    url.searchParams.set('key', key)
    let response: Response
    try { response = await fetch(url, { signal: AbortSignal.timeout(10000) }) }
    catch { return Response.json({ error: 'YouTube indisponível. Tente novamente.' }, { status: 502 }) }
    if (!response.ok) return Response.json({
      error: [403, 429].includes(response.status) ? 'Cota do YouTube indisponível.' : 'Falha ao consultar o YouTube.'
    }, { status: [403, 429].includes(response.status) ? 429 : 502 })
    const data = await response.json() as VideoResponse
    const item = data.items?.[0]
    const snippet = item?.snippet
    if (item?.id !== id || item.status?.privacyStatus !== 'public' || !snippet?.title ||
      !snippet.channelId || !/^UC[A-Za-z0-9_-]{22}$/.test(snippet.channelId) ||
      !snippet.channelTitle || !snippet.publishedAt || !Number.isFinite(Date.parse(snippet.publishedAt))) {
      return Response.json({ error: 'Vídeo público não encontrado.' }, { status: 404 })
    }
    return Response.json({
      youtube_video_id: id, youtube_channel_id: snippet.channelId,
      channel_name: snippet.channelTitle.slice(0, 200), title: snippet.title.slice(0, 500),
      thumbnail_url: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published_at: new Date(snippet.publishedAt).toISOString()
    })
  })
}
