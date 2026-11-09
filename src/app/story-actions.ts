import { state } from './state.ts'
import { supabase } from '../shared/api.ts'
import { attachStoryVideo, decideCandidate, followStory, renameStory, setStoryCompleted, unfollowStory } from '../shared/stories-api.ts'
import type { Video } from '../shared/model.ts'
import type { StoryCandidate, TrackedStory } from '../shared/story-model.ts'
import { saveCompletedYouTube, type YouTubeResult } from '../shared/saved-youtube.ts'
import { importChannelNow } from '../shared/import-channel.ts'
import { distinctEnough } from '../shared/story-match.ts'
import { scanStoryNow } from '../shared/story-discovery.ts'
import { rememberStoryScan } from './story-snapshot.ts'
import { promoteSavedVideo } from '../shared/promote-saved-video.ts'

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

function completedStoryName(video: YouTubeResult): string {
  const title = video.title.trim().replace(/\s+/g, ' ').slice(0, 200)
  return distinctEnough(title) ? title
    : `${title.slice(0, 150)} · ${video.channel_name.slice(0, 25)} · ${video.youtube_video_id}`
}

export function makeStoryActions(hooks: Hooks) {
  async function addYouTubeCompleted(video: YouTubeResult): Promise<void> {
    await hooks.act(async () => {
      const videoId = await saveCompletedYouTube(client(), hooks.userId(), video, importChannelNow)
      const story = await followStory(client(), hooks.userId(), videoId, completedStoryName(video), [])
      if (story.existing) await attachStoryVideo(client(), story.id, videoId)
      await setStoryCompleted(client(), hooks.userId(), story.id, true)
    })
  }

  async function follow(video: Video): Promise<void> {
    // O título exibido no cartão identifica inicialmente a história.
    // Nome e aliases continuam editáveis em “Minhas histórias”.
    const name = video.title.trim()
    const aliases: string[] = []
    if (state.demo) {
      const existing = [...state.stories.groups, ...state.stories.completed].find((group) =>
        group.story.canonical_key === name.toLocaleLowerCase('pt-BR').trim())
      if (existing) {
        if (existing.story.completed_at) {
          existing.story.completed_at = null; existing.story.is_followed = true
          state.stories.completed = state.stories.completed.filter((group) => group !== existing)
          state.stories.groups.push(existing)
        }
        const already = existing.story.seed_video_id === video.id ||
          existing.confirmed.some((item) => item.video_id === video.id)
        const rejected = existing.pending.some((item) => item.video_id === video.id)
        if (!already && !rejected) existing.confirmed.push({
          id: crypto.randomUUID(), story_id: existing.story.id, video_id: video.id,
          status: 'confirmed', score: 100, reason: 'Associação manual',
          detected_at: new Date().toISOString(), decided_at: new Date().toISOString(), video
        })
        location.hash = '#stories'
        hooks.render()
        return
      }
      const id = crypto.randomUUID()
      state.stories.groups.push({
        story: { id, owner_id: 'demo', seed_video_id: video.id, name, aliases,
          canonical_key: name.toLocaleLowerCase('pt-BR'), is_followed: true, completed_at: null,
          last_scanned_at: null, created_at: new Date().toISOString() },
        seed: video, confirmed: [], pending: []
      })
      location.hash = '#stories'
      hooks.render()
      return
    }
    let completed = false
    let scanFailed = false
    await hooks.act(async () => {
      const stored = video.external ? await promoteSavedVideo(client(), hooks.userId(), video, importChannelNow) : video
      const result = await followStory(client(), hooks.userId(), stored.id, name, aliases)
      if (result.existing) await attachStoryVideo(client(), result.id, stored.id)
      try { await scanStoryNow(client(), result.id); rememberStoryScan(result.id) }
      catch { scanFailed = true }
      completed = true
    })
    if (!completed) return
    location.hash = '#stories'
    if (scanFailed) { state.error = 'História acompanhada. Não foi possível procurar capítulos agora.'; hooks.render() }
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

  async function complete(story: TrackedStory, completed: boolean): Promise<void> {
    if (state.demo) {
      const from = completed ? state.stories.groups : state.stories.completed
      const to = completed ? state.stories.completed : state.stories.groups
      const group = from.find((item) => item.story.id === story.id)
      if (!group) return
      story.completed_at = completed ? new Date().toISOString() : null
      story.is_followed = !completed
      from.splice(from.indexOf(group), 1)
      to.push(group)
      hooks.render()
      return
    }
    await hooks.act(() => setStoryCompleted(client(), hooks.userId(), story.id, completed))
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

  return { follow, rename, unfollow, complete, addYouTubeCompleted, decide }
}
