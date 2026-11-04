import { appendFile } from 'node:fs/promises'
import { safeError } from '../collector/jobs/safe-error.ts'
import { decideDailySlot, loadWorkflowRuns, saoPauloDay } from './daily-limit.ts'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Contexto GitHub ausente: ${name}`)
  return value
}

try {
  const runId = Number(required('GITHUB_RUN_ID'))
  if (!Number.isSafeInteger(runId)) throw new Error('GITHUB_RUN_ID inválido.')
  const event = required('GITHUB_EVENT_NAME')
  const now = new Date().toISOString()
  const runs = await loadWorkflowRuns(
    required('GITHUB_REPOSITORY'), required('GITHUB_TOKEN'), saoPauloDay(now)
  )
  const decision = decideDailySlot(runId, event, now, runs)
  await appendFile(required('GITHUB_OUTPUT'), `allowed=${decision.allowed}\n`)
  console.log(`${decision.reason} Data: ${saoPauloDay(now)}; ` +
    `chamadas YouTube nesta execução: ${decision.allowed ? 'pendentes' : '0'}.`)
} catch (error) {
  console.error(`Limite diário não verificado: ${safeError(error)}; chamadas YouTube: 0.`)
  process.exitCode = 1
}
