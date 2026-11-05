import { state } from './state.ts'
import { changeChannelState, loadMonitor, requestCollection,
  type MonitorSnapshot } from '../shared/monitor-api.ts'
import { confirmBulk } from '../features/channels/bulk.ts'

interface Hooks {
  render(): void
  act(operation: () => Promise<void>): Promise<void>
  ready(): boolean
}

export function createMonitorController(hooks: Hooks) {
  let snapshot: MonitorSnapshot | null = null
  let error = ''
  let loading = false
  let working = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let runId: number | undefined
  let revision = 0

  function clearTimer(): void {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function stop(): void {
    revision++
    clearTimer()
    snapshot = null
    runId = undefined
    error = ''
    loading = false
    working = false
  }

  function schedule(delay: number): void {
    clearTimer()
    if (hooks.ready()) timer = setTimeout(() => { void refreshStatus() }, delay)
  }

  async function refreshStatus(): Promise<void> {
    if (!hooks.ready() || loading) return
    const ticket = revision
    loading = true
    error = ''
    hooks.render()
    try {
      const result = await loadMonitor(runId)
      if (ticket !== revision) return
      snapshot = result
      if (snapshot.run && !['aguardando', 'executando'].includes(snapshot.run.state)) runId = undefined
    } catch (cause) {
      if (ticket !== revision) return
      error = cause instanceof Error ? cause.message : 'Status indisponível.'
    } finally {
      if (ticket === revision) {
        loading = false
        hooks.render()
        schedule(snapshot?.run && ['aguardando', 'executando'].includes(snapshot.run.state) ? 15000 : 60000)
      }
    }
  }

  async function collect(): Promise<void> {
    if (!hooks.ready() || working || !snapshot?.manualAvailable) return
    const ticket = revision
    working = true
    error = ''
    hooks.render()
    try {
      const result = await requestCollection()
      if (ticket !== revision) return
      runId = result.runId
      snapshot = { ...snapshot, manualAvailable: false,
        manualReason: 'Coleta manual solicitada hoje.',
        run: { id: result.runId, trigger: 'manual', state: 'aguardando',
          scheduledAt: null, startedAt: null, finishedAt: null,
          videosProcessed: null, failures: null, quotaUnits: null, errors: [] } }
      schedule(4000)
    } catch (cause) {
      if (ticket !== revision) return
      error = cause instanceof Error ? cause.message : 'Não foi possível iniciar a coleta.'
      schedule(10000)
    } finally { if (ticket === revision) { working = false; hooks.render() } }
  }

  async function bulk(active: boolean): Promise<void> {
    if (state.busy) return
    const count = confirmBulk(state.channels, active, confirm)
    if (count === null) return
    if (state.demo) {
      for (const channel of state.channels) channel.is_active = active
      hooks.render()
      return
    }
    await hooks.act(async () => {
      const result = await changeChannelState(active, undefined, count)
      if (result.changed !== count) throw new Error('Quantidade alterada divergente. Confira os canais.')
    })
    void refreshStatus()
  }

  return {
    snapshot: () => ({ value: snapshot, error, loading: loading || working }),
    start: () => { if (hooks.ready() && !timer && !loading) void refreshStatus() },
    stop, refreshStatus, collect, bulk
  }
}
