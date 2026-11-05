import { state } from './state.ts'
import { supabase } from '../shared/api.ts'
import { decideCandidate, followStory, renameStory, unfollowStory } from '../shared/stories-api.ts'
import { suggestStoryName } from '../shared/story-match.ts'
import type { Video } from '../shared/model.ts'
import type { StoryCandidate, TrackedStory } from '../shared/story-model.ts'

interface Hooks {
  act: (operation: () => Promise<void>) => Promise<void>
  render: () => void
  userId: () => string
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

function aliasesInput(current: string[] = []): string[] | null {
  const answer = prompt('Outros nomes da obra, separados por vírgula (opcional):', current.join(', '))
  return answer === null ? null : answer.split(',').map((item) => item.trim()).filter(Boolean)
}

export function makeStoryActions(hooks: Hooks) {
  async function follow(video: Video): Promise<void> {
    const name = prompt('Nome da obra (corrija o título promocional, se necessário):',
      suggestStoryName(video.title))
    if (name === null) return
    const aliases = aliasesInput()
    if (aliases === null) return
    if (state.demo) {
      const id = crypto.randomUUID()
      state.stories.groups.push({
        story: { id, owner_id: 'demo', seed_video_id: video.id, name, aliases,
          canonical_key: name.toLocaleLowerCase('pt-BR'), is_followed: true,
          last_scanned_at: null, created_at: new Date().toISOString() },
        seed: video, confirmed: [], pending: []
      })
      location.hash = '#stories'
      hooks.render()
      return
    }
    let completed = false
    await hooks.act(async () => {
      await followStory(client(), hooks.userId(), video.id, name, aliases)
      completed = true
    })
    if (completed) location.hash = '#stories'
  }

  async function rename(story: TrackedStory): Promise<void> {
    const name = prompt('Nome correto da obra:', story.name)
    if (name === null) return
    const aliases = aliasesInput(story.aliases)
    if (aliases === null) return
    if (state.demo) { story.name = name; story.aliases = aliases; hooks.render(); return }
    await hooks.act(() => renameStory(client(), hooks.userId(), story.id, name, aliases))
  }

  async function unfollow(story: TrackedStory): Promise<void> {
    if (!confirm(`Deixar de acompanhar “${story.name}”? Os vídeos e favoritos serão mantidos.`)) return
    if (state.demo) {
      state.stories.groups = state.stories.groups.filter((group) => group.story.id !== story.id)
      hooks.render()
      return
    }
    await hooks.act(() => unfollowStory(client(), hooks.userId(), story.id))
  }

  async function decide(candidate: StoryCandidate, status: 'confirmed' | 'rejected'): Promise<void> {
    if (state.demo) {
      const group = state.stories.groups.find((item) => item.story.id === candidate.story_id)
      if (!group) return
      group.pending = group.pending.filter((item) => item.id !== candidate.id)
      if (status === 'confirmed') group.confirmed.push({ ...candidate, status })
      state.stories.pendingCount--
      hooks.render()
      return
    }
    await hooks.act(() => decideCandidate(client(), candidate.story_id, candidate.id, status))
  }

  return { follow, rename, unfollow, decide }
}
