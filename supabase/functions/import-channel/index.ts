import { withSupabase } from 'npm:@supabase/server@1.9.2'
import { importOne } from './import-one.ts'
import { parseImportInput } from './input.ts'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 })
    const ownerId = ctx.userClaims?.id
    if (!ownerId) return Response.json({ error: 'Não autenticado.' }, { status: 401 })
    const { data: owner, error: ownerError } = await ctx.supabase.from('profiles')
      .select('role').eq('user_id', ownerId).single()
    if (ownerError || owner?.role !== 'owner') {
      return Response.json({ error: 'Acesso não autorizado.' }, { status: 403 })
    }
    let data: unknown
    try { data = await req.json() } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }) }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return Response.json({ error: 'Solicitação inválida.' }, { status: 400 })
    }
    let handle: string | undefined
    let channelId: string | undefined
    try { ({ handle, channelId } = parseImportInput(data)) }
    catch { return Response.json({ error: 'Identificador de canal inválido.' }, { status: 400 }) }
    const db = ctx.supabaseAdmin
    if (!db) return Response.json({ error: 'Backend não configurado.' }, { status: 503 })
    const identifier = handle ? `@${handle.toLowerCase()}` : channelId!
    const { data: granted, error: gateError } = await db.rpc('reserve_replay_import', {
      p_owner: ownerId, p_identifier: identifier
    })
    if (gateError || !granted) {
      return Response.json({ error: 'Limite de importação ou operação em andamento.' }, { status: 429 })
    }
    const attemptId = String(granted)
    let result: Awaited<ReturnType<typeof importOne>>
    try {
      result = await importOne(db, ownerId, { handle, channelId })
    } catch (error) {
      const recorded = await db.from('replay_import_attempts')
        .update({ status: 'failed' }).eq('id', attemptId).eq('status', 'running')
        .select('id').single()
      if (recorded.error || !recorded.data) {
        return Response.json({ error: 'Falha ao registrar importação; contate o administrador.' }, { status: 503 })
      }
      const msg = error instanceof Error ? error.message : 'Erro na importação.'
      const known = /^(Canal não encontrado|Limite de 100 canais|Cota YouTube|YouTube API HTTP|Playlist inválida|Paginação repetida)/.test(msg)
      return Response.json({ error: known ? msg : 'Não foi possível importar o canal.' },
        { status: /^Cota YouTube/.test(msg) ? 429 : 502 })
    }
    const recorded = await db.from('replay_import_attempts')
      .update({ status: 'done' }).eq('id', attemptId).eq('status', 'running')
      .select('id').single()
    if (recorded.error || !recorded.data) {
      return Response.json({ error: 'Importação concluída, mas registro de status falhou.' }, { status: 503 })
    }
    return Response.json(result)
  })
}
