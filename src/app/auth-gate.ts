export type AuthPhase = 'initializing' | 'signed_in' | 'signed_out' | 'error'

interface AuthGateOptions<T extends { id: string }> {
  load: () => Promise<T | null>
  commit: (value: T | null) => void
  onError: (error: unknown) => void
  onChange: () => void
}

export function createAuthGate<T extends { id: string }>(options: AuthGateOptions<T>) {
  let phase: AuthPhase = 'initializing'
  let currentId = ''
  let requestedId = ''
  let revision = 0
  let started = false
  let loading: Promise<void> | null = null

  async function run(): Promise<void> {
    const ticket = revision
    try {
      const value = await options.load()
      if (ticket !== revision) return
      if (requestedId && (!value || (requestedId !== '*' && value.id !== requestedId))) return
      options.commit(value)
      currentId = value?.id ?? ''
      phase = value ? 'signed_in' : 'signed_out'
      options.onChange()
    } catch (error) {
      if (ticket !== revision) return
      if (!currentId) phase = 'error'
      options.onError(error)
      options.onChange()
    } finally {
      loading = null
      const nextId = requestedId
      requestedId = ''
      if (nextId && (nextId === '*' || nextId !== currentId)) {
        if (!currentId) phase = 'initializing'
        options.onChange()
        void recover()
      }
    }
  }

  function recover(): Promise<void> {
    if (!loading) loading = run()
    return loading
  }

  return {
    get phase(): AuthPhase { return phase },
    start(): Promise<void> {
      if (started) return loading ?? Promise.resolve()
      started = true
      options.onChange()
      return recover()
    },
    retry(): Promise<void> {
      if (!currentId) phase = 'initializing'
      options.onChange()
      return recover()
    },
    handle(event: string, userId?: string): void {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        revision += 1
        requestedId = ''
        currentId = ''
        phase = 'signed_out'
        options.commit(null)
        options.onChange()
      } else if (event === 'SIGNED_IN') {
        if (phase === 'signed_in' && currentId === userId) return
        requestedId = userId || '*'
        if (!currentId) phase = 'initializing'
        options.onChange()
        void recover()
      }
    }
  }
}
