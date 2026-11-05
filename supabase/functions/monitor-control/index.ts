import { createClient } from '@supabase/supabase-js'
import { githubClient } from './github-app.ts'
import { handleMonitorRequest, HttpError, type OwnerSession } from './handler.ts'
import { verifyOwner } from './auth.ts'

const runtime = globalThis as typeof globalThis & { Deno: { env: { get(name: string): string | undefined } } }

function required(name: string): string {
  const value = runtime.Deno.env.get(name)
  if (!value) throw new Error(`Configuração ausente: ${name}`)
  return value
}

async function owner(authorization: string): Promise<OwnerSession> {
  const token = authorization.slice(7)
  const keys = JSON.parse(required('SUPABASE_PUBLISHABLE_KEYS')) as Record<string, string>
  const db = createClient(required('SUPABASE_URL'), keys.default, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const userId = await verifyOwner(async () => {
    const identity = await db.auth.getUser(token)
    return identity.error ? null : identity.data.user
  }, async (id) => {
    const profile = await db.from('profiles').select('role').eq('user_id', id).maybeSingle()
    if (profile.error) throw new HttpError(503, 'Perfil indisponível.')
    return profile.data?.role ?? null
  })
  return {
    userId,
    async activeCount(): Promise<number> {
      const result = await db.from('channels').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('is_active', true)
      if (result.error || result.count === null) throw new Error('Falha ao consultar canais.')
      return result.count
    },
    async changeChannels(active, channelId, expectedCount): Promise<number> {
      let query = db.from('channels').select('id').eq('owner_id', userId).eq('is_active', !active)
      if (channelId) query = query.eq('id', channelId)
      const before = await query
      if (before.error) throw new Error('Falha ao consultar canais.')
      const ids = (before.data ?? []).map((channel) => channel.id as string)
      if (expectedCount !== null && ids.length !== expectedCount) {
        throw new HttpError(409, 'A quantidade mudou. Atualize a página e confirme novamente.')
      }
      if (!ids.length) return 0
      const result = await db.from('channels').update({ is_active: active })
        .in('id', ids).eq('owner_id', userId).eq('is_active', !active).select('id')
      if (result.error) throw new Error('Falha ao atualizar canais.')
      if (result.data?.length !== ids.length) {
        throw new HttpError(409, 'Atualização parcial. Confira a lista de canais.')
      }
      return ids.length
    }
  }
}

export default {
  fetch: (request: Request): Promise<Response> => handleMonitorRequest(request, {
    owner,
    now: () => new Date().toISOString(),
    github: () => githubClient({
      appId: required('REPLAY_GITHUB_APP_ID'),
      installationId: required('REPLAY_GITHUB_INSTALLATION_ID'),
      privateKey: required('REPLAY_GITHUB_APP_PRIVATE_KEY')
    })
  })
}
