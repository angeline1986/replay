import { state } from './state.ts'
import { supabase } from '../shared/api.ts'
import { findReplayVideos } from '../shared/find-video.ts'
import { lookupYouTube } from '../shared/saved-youtube.ts'
import { videoId } from '../../supabase/functions/lookup-youtube-video/input.ts'
import type { FindVideoOptions } from '../features/videos/find-menu.ts'
import type { makeActions } from './actions.ts'
import type { makeStoryActions } from './story-actions.ts'

export function makeFindHandlers(hooks: {
  actions: ReturnType<typeof makeActions>
  storyActions: ReturnType<typeof makeStoryActions>
  userId: () => string
  render: () => void
}): { favorites: FindVideoOptions; stories: FindVideoOptions } {
  const searchReplay: FindVideoOptions['searchReplay'] = (input) => {
    if (state.demo) {
      const term = input.trim().toLocaleLowerCase('pt-BR')
      const id = videoId(input)
      return Promise.resolve(state.videos.filter((video) => id
        ? video.youtube_video_id === id : video.title.toLocaleLowerCase('pt-BR').includes(term)))
    }
    if (!supabase) return Promise.reject(new Error('RePlay indisponível.'))
    return findReplayVideos(supabase, hooks.userId(), input, state.channels)
  }
  function searchYouTube(input: string, mode: 'favorites' | 'stories') {
    if (!supabase) return Promise.reject(new Error('Busca no YouTube indisponível no modo demonstração.'))
    return lookupYouTube(supabase, hooks.userId(), input, mode)
  }
  const favorites: FindVideoOptions = {
    target: 'favorites', searchReplay, searchYouTube: (input) => searchYouTube(input, 'favorites'),
    isAdded: (id) => (state.demo ? state.videos.filter((video) => video.state?.is_favorite)
      : state.favoriteVideos).some((video) => video.youtube_video_id === id),
    selectReplay: (video) => hooks.actions.favoriteFoundVideo(video),
    selectYouTube: (video) => hooks.actions.favoriteYouTube(video),
    showAdded: (id) => hooks.actions.revealCollectionVideo(id, 'favorites')
  }
  function trackedStory(id: string) {
    return state.stories.groups.find((group) => group.seed?.youtube_video_id === id ||
      group.confirmed.some((item) => item.video.youtube_video_id === id))
  }
  function showStory(id: string): void {
    const group = trackedStory(id)
    if (!group) { state.error = 'História acompanhada não encontrada. Atualize a página.'; hooks.render(); return }
    state.storyChannelId = ''
    state.storySort = 'recent'
    hooks.render()
    const card = document.querySelector<HTMLElement>(`[data-story-id="${group.story.id}"]`)
    card?.classList.add('just-added-video')
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const stories: FindVideoOptions = {
    target: 'stories', searchReplay, searchYouTube: (input) => searchYouTube(input, 'stories'),
    isAdded: (id) => Boolean(trackedStory(id)),
    selectReplay: async (video) => {
      await hooks.storyActions.follow(video)
      if (!state.error) showStory(video.youtube_video_id)
    },
    selectYouTube: async (video) => {
      await hooks.storyActions.followYouTube(video)
      if (!state.error) showStory(video.youtube_video_id)
    },
    showAdded: showStory
  }
  return { favorites, stories }
}
