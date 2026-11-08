import { loadVideoPage } from '../shared/api.ts'
import { ChannelPages, channelBase, loadNext } from '../features/videos/channel-pages.ts'
import { state } from './state.ts'

export function makeVideoLoader(pages: ChannelPages, userId: () => string, render: () => void) {
  return async (initial = false): Promise<void> => {
    if (state.busy || state.demo || !(state.filter.channelId
      ? pages.hasMore(state.filter.channelId) : state.hasMore)) return
    state.busy = true
    render()
    try {
      const base = channelBase(state.videos, state.filter.channelId)
      state.hasMore = await loadNext(state.filter.channelId, base, state.hasMore, pages,
        (offset, limit, channel) => loadVideoPage(userId(), state.channels, offset, limit, channel),
        initial ? Math.max(0, 4 - base.length) : 4)
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Não foi possível carregar vídeos.'
    } finally {
      state.busy = false
      render()
    }
  }
}
