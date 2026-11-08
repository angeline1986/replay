import type { SupabaseClient } from '@supabase/supabase-js'
import { loadClassifiedChannelVideos } from '../shared/video-collections.ts'
import type { AppState } from './state.ts'

export async function loadMarkedPage(state: AppState, db: SupabaseClient, userId: string): Promise<void> {
  const channel = state.channels.find((item) => item.id === state.filter.channelId)
  state.markedVideos = channel ? await loadClassifiedChannelVideos(db, userId, channel) : []
}
