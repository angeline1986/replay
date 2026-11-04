import { activeChannels, pruneRuns, recordRun, saveUploads } from '../persistence/store.ts'
import { processRequests } from './requests.ts'
import { runCollector } from './run.ts'

const key = process.env.YOUTUBE_API_KEY ?? ''
const result = await runCollector(key, { activeChannels, saveUploads, recordRun, pruneRuns })
const requests = await processRequests()
console.log(`Canais ativos: ${result.active}; chamadas da coleta: ${result.quotaUsed}; ` +
  `chamadas de handles: ${requests.calls}`)
if (result.failures + requests.failures) process.exitCode = 1
