import { createClient } from '@supabase/supabase-js'
import { resolveHandle } from '../youtube/resolve.ts'

interface Request {
  id: string
  owner_id: string
  handle: string
}

export async function processRequests(): Promise<number> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) { console.log('Resolução de handles desativada: API não configurada.'); return 0 }
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Configuração Supabase ausente.')
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await db.from('channel_requests')
    .select('id,owner_id,handle').eq('status', 'pending').order('created_at').limit(20)
  if (error) throw new Error(error.message)
  let failures = 0
  for (const request of (data ?? []) as Request[]) {
    try {
      const channel = await resolveHandle(request.handle, key)
      const saved = await db.from('channels').upsert({
        owner_id: request.owner_id, handle: `@${request.handle}`, ...channel
      }, { onConflict: 'owner_id,youtube_channel_id' })
      if (saved.error) throw new Error(saved.error.message)
      const updated = await db.from('channel_requests').update({ status: 'resolved' }).eq('id', request.id)
      if (updated.error) throw new Error(updated.error.message)
      console.log(`Handle resolvido: ${request.id}`)
    } catch (error) {
      failures++
      const summary = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[URL]') : 'Erro desconhecido'
      const retryable = /^YouTube API HTTP (429|5\d\d)$/.test(summary) ||
        error instanceof TypeError || error instanceof DOMException
      const updated = await db.from('channel_requests').update({
        status: retryable ? 'pending' : 'error', error_message: summary.slice(0, 200)
      }).eq('id', request.id)
      if (updated.error) console.error(`Falha de registro de handle: ${request.id}`)
      console.error(`Falha de resolução de handle: ${request.id}`)
    }
  }
  return failures
}
