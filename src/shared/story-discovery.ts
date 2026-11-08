import type { SupabaseClient } from '@supabase/supabase-js'

export async function scanStoryNow(db: SupabaseClient, storyId: string): Promise<number> {
  const { data, error } = await db.functions.invoke<{ found?: number }>('scan-story', {
    body: { storyId }
  })
  if (error) {
    const context = error.context as Response | undefined
    const body = context && 'json' in context ? await context.json().catch(() => null) : null
    throw new Error(body?.error ?? 'Não foi possível procurar capítulos já cadastrados.')
  }
  const found = data?.found
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 0) {
    throw new Error('Resposta inválida da busca de capítulos.')
  }
  return found
}
