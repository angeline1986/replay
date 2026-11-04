import type { ActiveChannel } from '../persistence/store.ts'
import { ApiBudget, MAX_ACTIVE_CHANNELS, QuotaError } from '../youtube/client.ts'
import { fetchUploads, uploadPlaylists, type Uploads } from '../youtube/uploads.ts'

export interface CollectorStore {
  activeChannels(): Promise<ActiveChannel[]>
  saveUploads(channel: ActiveChannel, uploads: Uploads): Promise<void>
  recordRun(channel: ActiveChannel, startedAt: string, status: 'success' | 'error',
    count: number, errorMessage: string | null): Promise<void>
  pruneRuns(): Promise<void>
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Erro desconhecido'
  return message.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ').slice(0, 240)
}

export async function runCollector(
  key: string, store: CollectorStore, fetcher: typeof fetch = fetch
): Promise<{ active: number; failures: number; quotaUsed: number }> {
  const channels = await store.activeChannels()
  if (!channels.length) return { active: 0, failures: 0, quotaUsed: 0 }
  if (channels.length > MAX_ACTIVE_CHANNELS) throw new Error('Limite de 100 canais ativos excedido.')
  if (!key) throw new Error('YOUTUBE_API_KEY ausente.')
  const budget = new ApiBudget()
  const playlists = await uploadPlaylists(
    channels.map((channel) => channel.youtube_channel_id), key, budget, fetcher
  )
  let failures = 0
  for (const channel of channels) {
    const startedAt = new Date().toISOString()
    try {
      const playlist = playlists.get(channel.youtube_channel_id)
      if (!playlist) throw new Error('Playlist de uploads não encontrada.')
      const uploads = await fetchUploads(playlist, channel.youtube_channel_id, key, budget, fetcher)
      await store.saveUploads(channel, uploads)
      await store.recordRun(channel, startedAt, 'success', uploads.videos.length, null)
      console.log(`Canal ${channel.id}: ${uploads.videos.length} vídeos processados`)
    } catch (error) {
      failures++
      const summary = safeError(error)
      console.error(`Canal ${channel.id}: ${summary}`)
      try { await store.recordRun(channel, startedAt, 'error', 0, summary) }
      catch (recordError) { console.error(`Falha de registro: ${safeError(recordError)}`) }
      if (error instanceof QuotaError) break
    }
  }
  await store.pruneRuns()
  return { active: channels.length, failures, quotaUsed: budget.used }
}
