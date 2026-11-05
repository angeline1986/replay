import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel } from '../src/shared/model.ts'
import { requireOwner } from './auth.ts'

export type MonitoredChannel = Pick<Channel, 'id' | 'name' | 'youtube_channel_id' | 'is_active'>

export async function listChannels(client: SupabaseClient): Promise<MonitoredChannel[]> {
  const ownerId = await requireOwner(client)
  const result = await client.from('channels')
    .select('id,name,youtube_channel_id,is_active').eq('owner_id', ownerId).order('name')
  if (result.error || !result.data) throw new Error('Não foi possível consultar os canais.')
  return result.data as MonitoredChannel[]
}

export function affectedChannels(channels: MonitoredChannel[], active: boolean): MonitoredChannel[] {
  return channels.filter((channel) => channel.is_active !== active)
}

export async function changeChannels(
  client: SupabaseClient, expected: MonitoredChannel[], active: boolean
): Promise<number> {
  const ownerId = await requireOwner(client)
  const current = await listChannels(client)
  const targets = affectedChannels(current, active)
  const expectedIds = expected.map((channel) => channel.id).sort()
  if (targets.length !== expectedIds.length ||
      targets.map((channel) => channel.id).sort().some((id, index) => id !== expectedIds[index])) {
    throw new Error('A lista de canais mudou. Revise a quantidade antes de confirmar novamente.')
  }
  if (!targets.length) return 0
  const result = await client.from('channels').update({ is_active: active })
    .eq('owner_id', ownerId).eq('is_active', !active)
    .in('id', expectedIds).select('id')
  if (result.error) throw new Error('Não foi possível alterar os canais.')
  if (result.data?.length !== expectedIds.length) {
    throw new Error('Alteração parcial detectada. Consulte a lista de canais antes de continuar.')
  }
  return expectedIds.length
}

export async function changeOne(client: SupabaseClient, channel: MonitoredChannel): Promise<void> {
  const ownerId = await requireOwner(client)
  const current = (await listChannels(client)).find((item) => item.id === channel.id)
  if (!current || current.is_active !== channel.is_active) {
    throw new Error('O estado deste canal mudou. Consulte a lista novamente.')
  }
  const result = await client.from('channels').update({ is_active: !channel.is_active })
    .eq('owner_id', ownerId).eq('id', channel.id)
    .eq('is_active', channel.is_active).select('id')
  if (result.error || result.data?.length !== 1) {
    throw new Error('Não foi possível alterar o canal. Consulte a lista novamente.')
  }
}
