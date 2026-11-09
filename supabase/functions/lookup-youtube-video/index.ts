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
    const save = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).save === true : false
    const id = videoId(input)
    if (!id) return Response.json({ error: 'Cole um link válido de vídeo do YouTube.' }, { status: 400 })
    if (save) {
      const cached = await ctx.supabase.from('saved_youtube_videos')
        .select('youtube_channel_id,channel_name,title,thumbnail_url,published_at')
        .eq('user_id', ctx.userClaims.id).eq('youtube_video_id', id).maybeSingle()
      if (cached.error) return Response.json({ error: 'Falha ao consultar vídeo salvo.' }, { status: 503 })
      if (cached.data) {
        const channel = await ctx.supabase.from('channels').select('id')
          .eq('owner_id', ctx.userClaims.id).eq('youtube_channel_id', cached.data.youtube_channel_id).maybeSingle()
        if (channel.error || !channel.data) {
          return Response.json({ error: 'Cadastre o canal antes de salvar o vídeo.' }, { status: 409 })
        }
        if (!ctx.supabaseAdmin) return Response.json({ error: 'Backend não configurado.' }, { status: 503 })
        const saved = await ctx.supabaseAdmin.from('videos').upsert({
          channel_id: channel.data.id, youtube_video_id: id, title: cached.data.title,
          url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: cached.data.thumbnail_url,
          published_at: cached.data.published_at
        }, { onConflict: 'channel_id,youtube_video_id' }).select('id').single()
        if (saved.error || !saved.data) return Response.json({ error: 'Não foi possível salvar o vídeo.' }, { status: 503 })
        return Response.json({ youtube_video_id: id, ...cached.data, video_id: saved.data.id })
      }
    }
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
    const result = {
      youtube_video_id: id, youtube_channel_id: snippet.channelId,
      channel_name: snippet.channelTitle.slice(0, 200), title: snippet.title.slice(0, 500),
      thumbnail_url: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published_at: new Date(snippet.publishedAt).toISOString()
    }
    if (!save) return Response.json(result)
    const channel = await ctx.supabase.from('channels').select('id').eq('owner_id', ctx.userClaims.id)
      .eq('youtube_channel_id', snippet.channelId).maybeSingle()
    if (channel.error || !channel.data) {
      return Response.json({ error: 'Cadastre o canal antes de salvar o vídeo.' }, { status: 409 })
    }
    if (!ctx.supabaseAdmin) return Response.json({ error: 'Backend não configurado.' }, { status: 503 })
    const saved = await ctx.supabaseAdmin.from('videos').upsert({
      channel_id: channel.data.id, youtube_video_id: id, title: result.title,
      url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: result.thumbnail_url,
      published_at: result.published_at
    }, { onConflict: 'channel_id,youtube_video_id' }).select('id').single()
    if (saved.error || !saved.data) return Response.json({ error: 'Não foi possível salvar o vídeo.' }, { status: 503 })
    return Response.json({ ...result, video_id: saved.data.id })
  })
}
