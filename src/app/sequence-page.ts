import { sequenceView } from '../features/stories/sequence-view.ts'
import type { StoryDashboard } from '../shared/story-model.ts'
import type { makeActions } from './actions.ts'
import type { makeStoryActions } from './story-actions.ts'
import { state } from './state.ts'

export function sequencePage(
  data: StoryDashboard, id: string,
  actions: ReturnType<typeof makeActions>, stories: ReturnType<typeof makeStoryActions>
): HTMLElement {
  return sequenceView({ data, id, onBack: () => { location.hash = '#stories' },
    onUnfollow: (story) => { void stories.unfollow(story).then(() => {
      if (!state.stories.groups.some((group) => group.story.id === story.id)) location.hash = '#stories'
    }) },
    onResume: (story) => { void stories.complete(story, false) },
    onToggle: (video, key) => { void actions.toggleVideo(video, key) },
    onDecide: (candidate, status) => { void stories.decide(candidate, status) } })
}
