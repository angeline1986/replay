import type { ActiveChannel } from '../persistence/store.ts'
import { ApiBudget, MAX_ACTIVE_CHANNELS, QuotaError } from '../youtube/client.ts'
import { fetchUploads, uploadPlaylists, type Uploads } from '../youtube/uploads.ts'
import { safeError } from './safe-error.ts'

export interface CollectorStore {
  activeChannels(): Promise<ActiveChannel[]>
  saveUploads(channel: ActiveChannel, uploads: Uploads): Promise<void>
  recordRun(channel: ActiveChannel, startedAt: string, status: 'success' | 'error',
    count: number, errorMessage: string | null): Promise<void>
  pruneRuns(): Promise<void>
}

export interface CollectorSummary {
  active: number
  processed: number
  videos: number
  failures: number
  quotaUsed: number
  quotaStopped: boolean
  fatalError: string | null
}

export async function runCollector(
  key: string, store: CollectorStore, fetcher: typeof fetch = fetch
): Promise<CollectorSummary> {
  const channels = await store.activeChannels()
  const result: CollectorSummary = { active: channels.length, processed: 0, videos: 0,
    failures: 0, quotaUsed: 0, quotaStopped: false, fatalError: null }
  if (!channels.length) return result
  if (channels.length > MAX_ACTIVE_CHANNELS || !key) {
    result.failures = 1
    result.fatalError = channels.length > MAX_ACTIVE_CHANNELS
      ? 'Limite de 100 canais ativos excedido.' : 'YOUTUBE_API_KEY ausente.'
    return result
  }
  const budget = new ApiBudget()
  let playlists: Map<string, string>
  try {
    playlists = await uploadPlaylists(
      channels.map((channel) => channel.youtube_channel_id), key, budget, fetcher
    )
  } catch (error) {
    result.failures = 1
    result.fatalError = safeError(error)
    result.quotaStopped = error instanceof QuotaError
    result.quotaUsed = budget.used
    return result
  }
  for (const channel of channels) {
    const startedAt = new Date().toISOString()
    result.processed++
    try {
      const playlist = playlists.get(channel.youtube_channel_id)
      if (!playlist) throw new Error('Playlist de uploads não encontrada.')
      const uploads = await fetchUploads(playlist, channel.youtube_channel_id, key, budget, fetcher)
      await store.saveUploads(channel, uploads)
      await store.recordRun(channel, startedAt, 'success', uploads.videos.length, null)
      result.videos += uploads.videos.length
      console.log(`Canal ${channel.id}: ${uploads.videos.length} vídeos processados`)
    } catch (error) {
      result.failures++
      const summary = safeError(error)
      console.error(`Canal ${channel.id}: ${summary}`)
      try { await store.recordRun(channel, startedAt, 'error', 0, summary) }
      catch (recordError) { console.error(`Falha de registro: ${safeError(recordError)}`) }
      if (error instanceof QuotaError) { result.quotaStopped = true; break }
    }
  }
  result.quotaUsed = budget.used
  try { await store.pruneRuns() }
  catch (error) { result.failures++; result.fatalError = safeError(error) }
  return result
}
