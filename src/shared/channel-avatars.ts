import type { Channel } from './model.ts'

export interface AvatarRefreshClient {
  functions: {
    invoke(name: string, options: { body: Record<string, never> }):
      Promise<{ data: unknown; error: { message: string } | null }>
  }
}

export async function invokeAvatarRefresh(client: AvatarRefreshClient): Promise<number> {
  const { data, error } = await client.functions.invoke('refresh-channel-avatars', { body: {} })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return 0
  const refreshed = (data as Record<string, unknown>).refreshed
  return typeof refreshed === 'number' && Number.isInteger(refreshed) && refreshed > 0 ? refreshed : 0
}

let attempted = false
export async function backfillMissingAvatars(channels: Channel[]): Promise<boolean> {
  if (attempted || !channels.some((channel) => !channel.avatar_url)) return false
  attempted = true
  try {
    const { supabase } = await import('./api.ts')
    return supabase ? (await invokeAvatarRefresh(supabase)) > 0 : false
  } catch { return false }
}
