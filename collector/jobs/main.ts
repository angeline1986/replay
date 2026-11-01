import { fetchFeed } from '../feeds/fetch.ts'
import { activeChannels, pruneRuns, recordRun, saveFeed } from '../persistence/store.ts'
import { processRequests } from './requests.ts'

function safeError(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Erro desconhecido'
  return text.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ').slice(0, 240)
}

let failures = 0
failures += await processRequests()
const channels = await activeChannels()
console.log(`Canais ativos: ${channels.length}`)
for (const channel of channels) {
  const startedAt = new Date().toISOString()
  try {
    const feed = await fetchFeed(channel.youtube_channel_id)
    await saveFeed(channel, feed)
    await recordRun(channel, startedAt, 'success', feed.videos.length, null)
    console.log(`Canal ${channel.id}: ${feed.videos.length} vídeos processados`)
  } catch (error) {
    failures++
    const summary = safeError(error)
    console.error(`Canal ${channel.id}: ${summary}`)
    try { await recordRun(channel, startedAt, 'error', 0, summary) }
    catch (recordError) { console.error(`Falha de registro: ${safeError(recordError)}`) }
  }
}
await pruneRuns()
if (failures) process.exitCode = 1
