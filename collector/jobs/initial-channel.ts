import { MAX_ACTIVE_CHANNELS } from '../youtube/client.ts'

export interface ChannelIdentity {
  youtube_channel_id: string
  name: string
  avatar_url: string | null
}

export interface StoredChannel extends ChannelIdentity {
  id: string
  is_active: boolean
}

export interface ImportRequest {
  ownerId: string
  handle?: string
  channelId?: string
}

export interface InitialImportDeps<Uploads> {
  resolveHandle(handle: string): Promise<ChannelIdentity>
  resolveId(channelId: string): Promise<ChannelIdentity>
  countActive(ownerId: string): Promise<number>
  findChannel(ownerId: string, channelId: string): Promise<StoredChannel | null>
  createChannel(ownerId: string, channel: ChannelIdentity, handle: string | null): Promise<StoredChannel>
  fetchUploads(channelId: string): Promise<Uploads>
  saveUploads(channel: StoredChannel, uploads: Uploads): Promise<number>
}

export type ImportResult = {
  status: 'imported' | 'already_monitored'
  channel: StoredChannel
  importedVideos: number
}

const channelPattern = /^UC[A-Za-z0-9_-]{22}$/
const handlePattern = /^[A-Za-z0-9_.-]{3,30}$/

export async function importInitialChannel<Uploads>(
  input: ImportRequest, deps: InitialImportDeps<Uploads>
): Promise<ImportResult> {
  if (!input.ownerId) throw new Error('Usuário não autenticado.')
  if (Boolean(input.handle) === Boolean(input.channelId)) {
    throw new Error('Informe exatamente um handle ou ID de canal.')
  }
  if (input.handle && !handlePattern.test(input.handle)) throw new Error('Handle inválido.')
  if (input.channelId && !channelPattern.test(input.channelId)) throw new Error('ID de canal inválido.')

  const identity = input.handle
    ? await deps.resolveHandle(input.handle)
    : await deps.resolveId(input.channelId!)
  if (!channelPattern.test(identity.youtube_channel_id) || !identity.name.trim()) {
    throw new Error('Resposta de canal inválida.')
  }

  const existing = await deps.findChannel(input.ownerId, identity.youtube_channel_id)
  if (existing) return { status: 'already_monitored', channel: existing, importedVideos: 0 }
  if (await deps.countActive(input.ownerId) >= MAX_ACTIVE_CHANNELS) {
    throw new Error('Limite de 100 canais ativos atingido.')
  }

  // A camada de persistência deve garantir UNIQUE(owner_id,youtube_channel_id).
  // O controle de concorrência e cota compartilhada pertence ao backend autenticado.
  const channel = await deps.createChannel(input.ownerId, identity, input.handle ?? null)
  const uploads = await deps.fetchUploads(channel.youtube_channel_id)
  const importedVideos = await deps.saveUploads(channel, uploads)
  return { status: 'imported', channel, importedVideos }
}
