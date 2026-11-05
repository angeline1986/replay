import { activeChannels, pruneRuns, recordRun, saveUploads } from '../persistence/store.ts'
import { processRequests } from './requests.ts'
import { runCollector } from './run.ts'
import { safeError } from './safe-error.ts'
import { detectStoryCandidates } from '../stories/detect.ts'
import { storyStore } from '../stories/store.ts'

try {
  const key = process.env.YOUTUBE_API_KEY ?? ''
  const result = await runCollector(key, { activeChannels, saveUploads, recordRun, pruneRuns })
  let requests = { failures: 0, calls: 0 }
  if (!result.quotaStopped && !result.fatalError) {
    try { requests = await processRequests() }
    catch (error) { requests.failures++; console.error(`Falha em handles: ${safeError(error)}`) }
  }
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
    `cota YouTube estimada=${result.quotaUsed + requests.calls} unidades.`)
  if (failures) process.exitCode = 1
} catch (error) {
  console.error(`Falha antes da coleta: ${safeError(error)}; cota YouTube estimada=0.`)
  process.exitCode = 1
}
