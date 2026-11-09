import type { SupabaseClient } from '@supabase/supabase-js'

interface SyncRun { started_at: string; status: string; item_count: number }
interface Attempt { created_at: string; status: string }

export interface UsageSummary {
  day: string
  lower: number
  upper: number
  channels: number
  attempts: number
  lastCheck: string | null
}

const pacific = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
})

function dayKey(date: Date): string {
  const parts = Object.fromEntries(pacific.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function summarizeUsage(runs: SyncRun[], attempts: Attempt[], now = new Date()): UsageSummary {
  const day = dayKey(now)
  const todayRuns = runs.filter((row) => dayKey(new Date(row.started_at)) === day)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
  const todayAttempts = attempts.filter((row) => dayKey(new Date(row.created_at)) === day)
  let channelCalls = 0
  let batchSize = 0
  let previous = 0
  for (const row of todayRuns) {
    const time = Date.parse(row.started_at)
    if (batchSize && time - previous > 15 * 60_000) {
      channelCalls += Math.ceil(batchSize / 50)
      batchSize = 0
    }
    batchSize++
    previous = time
  }
  channelCalls += Math.ceil(batchSize / 50)
  const playlistMinimum = todayRuns.reduce((total, row) => total +
    (row.status === 'success' ? Math.max(1, Math.ceil(row.item_count / 50)) : 0), 0)
  const lower = channelCalls + playlistMinimum + todayAttempts.filter((row) => row.status === 'done').length
  const upper = channelCalls + todayRuns.length * 2 + todayAttempts.length * 2
  return { day, lower, upper, channels: todayRuns.length, attempts: todayAttempts.length,
    lastCheck: todayRuns.at(-1)?.started_at ?? null }
}

export async function loadUsage(db: SupabaseClient, ownerId: string): Promise<UsageSummary> {
  const since = new Date(Date.now() - 48 * 60 * 60_000).toISOString()
  const [runs, attempts] = await Promise.all([
    db.from('sync_runs').select('started_at,status,item_count').gte('started_at', since)
      .order('started_at', { ascending: false }).range(0, 499),
    db.from('replay_import_attempts').select('created_at,status').eq('owner_id', ownerId)
      .gte('created_at', since).order('created_at', { ascending: false }).range(0, 49)
  ])
  if (runs.error) throw new Error(runs.error.message)
  if (attempts.error) throw new Error(attempts.error.message)
  return summarizeUsage(runs.data ?? [], attempts.data ?? [])
}
