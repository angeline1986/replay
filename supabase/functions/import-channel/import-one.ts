import { youtube } from './youtube.ts'

type DB = any
interface Input { handle?: string; channelId?: string }
interface Channel { id: string; youtube_channel_id: string; last_success_at: string | null }

function checked<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error('Falha na persistência.')
  if (result.data === null) throw new Error('Resposta de persistência vazia.')
  return result.data
}

export async function importOne(db: DB, owner: string, input: Input) {
  const key = (globalThis as typeof globalThis & { Deno: { env: { get(name: string): string | undefined } } }).Deno.env.get('YOUTUBE_API_KEY')
  if (!key) throw new Error('Chave YouTube não configurada.')
  const channel = await youtube.channel(key, input)
  const found = await db.from('channels')
    .select('id,youtube_channel_id,last_success_at').eq('owner_id', owner)
    .eq('youtube_channel_id', channel.id).maybeSingle()
  if (found.error) throw new Error('Falha ao consultar canal.')
  const existing = found.data as Channel | null
  if (existing?.last_success_at) {
    return { status: 'already_monitored', channelId: existing.id, importedVideos: 0 }
  }
  const total = await db.from('channels').select('*', { count: 'exact', head: true })
    .eq('owner_id', owner).eq('is_active', true)
  if (total.error) throw new Error('Falha ao consultar canais.')
  if (!existing && (total.count ?? 0) >= 100) throw new Error('Limite de 100 canais ativos atingido.')
  // Retry de canal incompleto: reutilizar a mesma linha, sem reativar um canal pausado.
  const saved = existing ?? checked(await db.from('channels').upsert({
    owner_id: owner, youtube_channel_id: channel.id, name: channel.name,
    avatar_url: channel.avatar, handle: input.handle ? `@${input.handle}` : null,
    is_active: true
  }, { onConflict: 'owner_id,youtube_channel_id' }).select('id,youtube_channel_id').single()) as Channel
  const videos = await youtube.uploads(key, channel.id, channel.playlist)
  if (videos.length) checked(await db.from('videos').upsert(
    videos.map((video) => ({ ...video, channel_id: saved.id })),
    { onConflict: 'channel_id,youtube_video_id' }).select('id'))
  const stamp = new Date().toISOString()
  const update = await db.from('channels')
    .update({ last_checked_at: stamp, last_success_at: stamp }).eq('id', saved.id)
  if (update.error) throw new Error('Falha ao atualizar o canal.')
  return { status: 'imported', channelId: saved.id, importedVideos: videos.length }
}
