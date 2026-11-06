import { createClient } from '@supabase/supabase-js'
import { ApiBudget, QuotaError } from '../youtube/client.ts'
import { resolveHandle } from '../youtube/resolve.ts'
import { safeError } from './safe-error.ts'

interface Request {
  id: string
  owner_id: string
  handle: string
}

export async function processRequests(maxRequests = 20, budget = new ApiBudget(20)):
  Promise<{ failures: number; calls: number; quotaStopped: boolean }> {
  if (maxRequests <= 0) return { failures: 0, calls: 0, quotaStopped: false }
  const key = process.env.YOUTUBE_API_KEY
  if (!key) { console.log('Resolução de handles desativada: API não configurada.'); return { failures: 0, calls: 0, quotaStopped: false } }
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Configuração Supabase ausente.')
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await db.from('channel_requests')
    .select('id,owner_id,handle').eq('status', 'pending').order('created_at').limit(Math.min(20, maxRequests))
  if (error) throw new Error(error.message)
  let failures = 0
  const startUsed = budget.used
  let quotaStopped = false
  for (const request of (data ?? []) as Request[]) {
    try {
      const channel = await resolveHandle(request.handle, key, budget)
      const saved = await db.from('channels').upsert({
        owner_id: request.owner_id, handle: `@${request.handle}`, ...channel
      }, { onConflict: 'owner_id,youtube_channel_id' })
      if (saved.error) throw new Error(saved.error.message)
      const updated = await db.from('channel_requests').update({ status: 'resolved' }).eq('id', request.id)
      if (updated.error) throw new Error(updated.error.message)
      console.log(`Handle resolvido: ${request.id}`)
    } catch (error) {
      failures++
      const summary = safeError(error)
      const retryable = error instanceof QuotaError || /^YouTube API HTTP (429|5\d\d)$/.test(summary) ||
        error instanceof TypeError || error instanceof DOMException
      const updated = await db.from('channel_requests').update({
        status: retryable ? 'pending' : 'error', error_message: summary.slice(0, 200)
      }).eq('id', request.id)
      if (updated.error) console.error(`Falha de registro de handle: ${request.id}`)
      console.error(`Falha de resolução de handle: ${request.id}`)
      if (error instanceof QuotaError) { quotaStopped = true; break }
    }
  }
  return { failures, calls: budget.used - startUsed, quotaStopped }
}
