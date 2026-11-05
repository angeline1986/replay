import { supabase } from './api.ts'

export type MonitorState = 'aguardando' | 'executando' | 'concluída' | 'bloqueada' | 'falhou'

export interface MonitorRun {
  id: number
  state: MonitorState
  trigger: 'automática' | 'manual'
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  videosProcessed: number | null
  failures: number | null
  quotaUnits: number | null
  errors: string[]
}

export interface MonitorSnapshot {
  run: MonitorRun | null
  manualAvailable: boolean
  manualReason: string
  activeChannels: number
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase ainda não configurado.')
  const { data, error } = await supabase.functions.invoke('monitor-control', { body })
  if (error) {
    const context = error.context
    if (context instanceof Response) {
      const detail = await context.json().catch(() => null) as { error?: string; reason?: string } | null
      throw new Error(detail?.reason ?? detail?.error ?? error.message)
    }
    throw new Error(error.message)
  }
  if (!data || typeof data !== 'object') throw new Error('Resposta inválida do monitoramento.')
  return data as T
}

export function loadMonitor(runId?: number): Promise<MonitorSnapshot> {
  return invoke<MonitorSnapshot>({ action: 'status', ...(runId ? { runId } : {}) })
}

export function requestCollection(): Promise<{ state: 'aguardando'; runId: number }> {
  return invoke<{ state: 'aguardando'; runId: number }>({ action: 'dispatch' })
}

export function changeChannelState(active: boolean, channelId?: string,
  expectedCount?: number): Promise<{ changed: number }> {
  return invoke<{ changed: number }>({ action: 'channels', active,
    ...(channelId ? { channelId } : { expectedCount }) })
}
