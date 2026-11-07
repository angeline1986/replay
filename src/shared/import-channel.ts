export interface InitialImportResponse {
  status: 'imported' | 'already_monitored'
  channelId: string
  importedVideos: number
}

export interface ImportInvoker {
  functions: {
    invoke(name: string, options: { body: { handle?: string; channelId?: string } }):
      Promise<{ data: unknown; error: { message: string } | null }>
  }
}

export async function invokeInitialImport(
  client: ImportInvoker, input: { handle?: string; id?: string }
): Promise<InitialImportResponse> {
  const body = input.handle ? { handle: input.handle } : { channelId: input.id }
  const { data, error } = await client.functions.invoke('import-channel', { body })
  if (error) throw new Error('Importação indisponível. Confira a função no Supabase.')
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resposta inválida do servidor.')
  }
  const result = data as Record<string, unknown>
  if (result.error) throw new Error('O servidor não conseguiu importar o canal.')
  if ((result.status !== 'imported' && result.status !== 'already_monitored') ||
      typeof result.channelId !== 'string' || !result.channelId ||
      typeof result.importedVideos !== 'number' ||
      !Number.isInteger(result.importedVideos) ||
      result.importedVideos < 0 || result.importedVideos > 50) {
    throw new Error('Resposta inválida do servidor.')
  }
  return result as unknown as InitialImportResponse
}

export async function importChannelNow(input: { handle?: string; id?: string }) {
  const { supabase } = await import('./api.ts')
  if (!supabase) throw new Error('Supabase não configurado.')
  return invokeInitialImport(supabase, input)
}
