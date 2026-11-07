export interface ImportInput { handle?: string; channelId?: string }

export function parseImportInput(data: unknown): ImportInput {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Solicitação inválida.')
  }
  const input = data as Record<string, unknown>
  if (Object.keys(input).some((key) => !['handle', 'channelId'].includes(key))) {
    throw new Error('Identificador de canal inválido.')
  }
  const { handle, channelId } = input
  if ((handle === undefined) === (channelId === undefined) ||
      (handle !== undefined && (typeof handle !== 'string' ||
        !/^[A-Za-z0-9_.-]{3,30}$/.test(handle))) ||
      (channelId !== undefined && (typeof channelId !== 'string' ||
        !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)))) {
    throw new Error('Identificador de canal inválido.')
  }
  return { handle: handle as string | undefined, channelId: channelId as string | undefined }
}
