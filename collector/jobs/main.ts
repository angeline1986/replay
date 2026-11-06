import { activeChannels, pruneRuns, recordRun, saveUploads } from '../persistence/store.ts'
import { processRequests } from './requests.ts'
import { ApiBudget, MAX_ACTIVE_CHANNELS } from '../youtube/client.ts'
import { runCollector } from './run.ts'
import { safeError } from './safe-error.ts'
import { detectStoryCandidates } from '../stories/detect.ts'
import { storyStore } from '../stories/store.ts'

try {
  const key = process.env.YOUTUBE_API_KEY ?? ''
  const budget = new ApiBudget()
  const activeBefore = await activeChannels()
  let requests = { failures: 0, calls: 0, quotaStopped: false }
  if (activeBefore.length <= MAX_ACTIVE_CHANNELS) {
    try {
      requests = await processRequests(MAX_ACTIVE_CHANNELS - activeBefore.length, budget)
    } catch (error) {
      requests.failures++
      console.error(`Falha em handles: ${safeError(error)}`)
    }
  }
  // Reconsulta o banco para incluir os canais recém-confirmados nesta coleta.
  const result = requests.quotaStopped ? {
    active: activeBefore.length, processed: 0, videos: 0, failures: 0,
    quotaUsed: budget.used, quotaStopped: true, fatalError: null
  } : await runCollector(key, { activeChannels, saveUploads, recordRun, pruneRuns }, fetch, budget)
  let stories = { stories: 0, candidates: 0, failures: 0 }
  try { stories = await detectStoryCandidates(storyStore) }
  catch (error) { stories.failures++; console.error(`Falha na detecção: ${safeError(error)}`) }
  console.log(`Histórias verificadas=${stories.stories}; ` +
    `sugestões novas=${stories.candidates}; falhas=${stories.failures}.`)
  if (result.fatalError) console.error(`Falha na coleta: ${result.fatalError}`)
  const failures = result.failures + requests.failures + stories.failures
  console.log(`Resultado: ${failures ? 'erro' : 'sucesso'}; ` +
    `gatilho=${process.env.GITHUB_EVENT_NAME ?? 'local'}; ativos=${result.active}; ` +
    `processados=${result.processed}; vídeos=${result.videos}; falhas=${failures}; ` +
    `cota YouTube estimada=${budget.used} unidades.`)
  if (failures) process.exitCode = 1
} catch (error) {
  console.error(`Falha antes da coleta: ${safeError(error)}; cota YouTube estimada=0.`)
  process.exitCode = 1
}
