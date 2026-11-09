import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSummary, summaryView } from '../features/summary/index.ts'
import '../features/summary/view.css'
import type { AppState } from './state.ts'

export function summaryPage(state: AppState, db: SupabaseClient | null, userId: string): HTMLElement {
  return summaryView({
    channels: state.channels, launchCount: state.highlights.length,
    favorites: state.demo ? state.videos.filter((video) => video.state?.is_favorite) : state.favoriteVideos,
    queued: state.demo ? state.videos.filter((video) => video.state?.is_queued) : state.queuedVideos,
    deprioritized: state.demo ? state.videos.filter((video) => video.state?.is_deprioritized) : state.deprioritizedVideos,
    stories: state.stories,
    demoVideos: state.demo ? state.videos : undefined,
    load: state.demo ? undefined : () => loadSummary(db!, userId, state.channels)
  })
}
