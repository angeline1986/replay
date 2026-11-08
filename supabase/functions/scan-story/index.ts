import { withSupabase } from 'npm:@supabase/server@1.9.2'
import { findExistingChapters, parseStoryPosition } from '../../../src/shared/story-match.ts'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const error = (message: string, status: number) => Response.json({ error: message }, { status })

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return error('Método não permitido.', 405)
    if (!ctx.userClaims?.id) return error('Não autenticado.', 401)
    const profile = await ctx.supabase.from('profiles').select('role')
      .eq('user_id', ctx.userClaims.id).maybeSingle()
    if (profile.error || profile.data?.role !== 'owner') return error('Acesso não autorizado.', 403)
    let input: unknown
    try { input = await req.json() } catch { return error('JSON inválido.', 400) }
    const storyId = input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>).storyId : null
    if (typeof storyId !== 'string' || !uuid.test(storyId)) return error('História inválida.', 400)
    const db = ctx.supabaseAdmin
    if (!db) return error('Backend não configurado.', 503)
    const story = await ctx.supabase.from('tracked_stories')
      .select('id,name,aliases,seed_video_id,is_followed').eq('id', storyId)
      .eq('owner_id', ctx.userClaims.id).maybeSingle()
    if (story.error || !story.data?.is_followed || !story.data.seed_video_id) {
      return error('História indisponível.', 404)
    }
    const seed = await db.from('videos').select('id,channel_id,title,published_at')
      .eq('id', story.data.seed_video_id).single()
    if (seed.error || !seed.data) return error('Vídeo inicial indisponível.', 404)
    const channel = await ctx.supabase.from('channels').select('id').eq('id', seed.data.channel_id)
      .eq('owner_id', ctx.userClaims.id).maybeSingle()
    if (channel.error || !channel.data) return error('Canal indisponível.', 404)
    const matches = await db.from('story_matches').select('video_id,status').eq('story_id', storyId)
    if (matches.error) return error('Falha ao consultar capítulos.', 503)
    const known = new Set<string>([seed.data.id, ...(matches.data ?? []).map((row) => row.video_id)])
    const bridge = new Set<string>((matches.data ?? [])
      .filter((row) => row.status !== 'rejected').map((row) => row.video_id))
    const videos: Array<{ id: string; title: string; channelId: string; publishedAt: string }> = []
    for (let offset = 0; offset < 1000; offset += 200) {
      const page = await db.from('videos').select('id,title,published_at')
        .eq('channel_id', channel.data.id).gt('published_at', seed.data.published_at)
        .order('published_at').order('id').range(offset, offset + 199)
      if (page.error) return error('Falha ao consultar vídeos do canal.', 503)
      videos.push(...(page.data ?? []).map((row) => ({ id: row.id, title: row.title,
        channelId: channel.data.id, publishedAt: row.published_at })))
      if ((page.data ?? []).length < 200) break
    }
    const chapters = findExistingChapters({ title: story.data.name, aliases: story.data.aliases ?? [],
      channelIds: [channel.data.id], lastPosition: parseStoryPosition(seed.data.title),
      latestPublishedAt: seed.data.published_at }, videos, known, bridge)
    let added = 0
    for (let offset = 0; offset < chapters.length; offset += 100) {
      const rows = chapters.slice(offset, offset + 100).map(({ id, match }) => ({
        story_id: storyId, video_id: id, status: 'pending', score: match.score,
        reason: match.reason, position_kind: match.position?.kind ?? null,
        position_first: match.position?.first ?? null, position_last: match.position?.last ?? null,
        season: match.position?.season ?? null
      }))
      const saved = await db.from('story_matches').upsert(rows, {
        onConflict: 'story_id,video_id', ignoreDuplicates: true
      }).select('id')
      if (saved.error) return error('Falha ao salvar capítulos encontrados.', 503)
      added += saved.data?.length ?? 0
    }
    return Response.json({ found: added, scanned: videos.length })
  })
}
