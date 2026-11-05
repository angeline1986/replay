import { state } from './state.ts'
import { supabase } from '../shared/api.ts'
import { attachStoryVideo, decideCandidate, followStory, renameStory, unfollowStory } from '../shared/stories-api.ts'
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
    const groups = state.stories.groups
    if (groups.length && confirm('Adicionar este vídeo a uma história que você já acompanha?')) {
      const menu = groups.map((group, index) => `${index + 1}. ${group.story.name}`).join('\n')
      const choice = prompt(`Escolha o número da história:
${menu}`)
      if (choice === null) return
      const index = Number(choice) - 1
      if (!Number.isInteger(index) || index < 0 || index >= groups.length) return
      const group = groups[index]
      if (!confirm(`Confirmar vínculo deste vídeo com “${group.story.name}”?`)) return
      if (state.demo) {
        const pending = group.pending.find((item) => item.video_id === video.id)
        const existing = group.confirmed.some((item) => item.video_id === video.id) ||
          group.story.seed_video_id === video.id
        if (pending) {
          group.pending = group.pending.filter((item) => item.id !== pending.id)
          group.confirmed.push({ ...pending, status: 'confirmed' })
          state.stories.pendingCount--
        } else if (!existing) {
          group.confirmed.push({ id: crypto.randomUUID(), story_id: group.story.id,
            video_id: video.id, status: 'confirmed', score: 100, reason: 'Associação manual',
            detected_at: new Date().toISOString(), decided_at: new Date().toISOString(), video })
        }
        location.hash = '#stories'
        hooks.render()
        return
      }
      let linked = false
      await hooks.act(async () => {
        await attachStoryVideo(client(), group.story.id, video.id)
        linked = true
      })
      if (linked) location.hash = '#stories'
      return
    }
    const name = prompt('Nome da obra (corrija o título promocional, se necessário):',
      suggestStoryName(video.title))
    if (name === null) return
    const aliases = aliasesInput()
    if (aliases === null) return
    if (state.demo) {
      const existing = state.stories.groups.find((group) =>
        group.story.canonical_key === name.toLocaleLowerCase('pt-BR').trim())
      if (existing) {
        if (!confirm(`Adicionar este vídeo à história “${existing.story.name}”?`)) return
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
          canonical_key: name.toLocaleLowerCase('pt-BR'), is_followed: true,
          last_scanned_at: null, created_at: new Date().toISOString() },
        seed: video, confirmed: [], pending: []
      })
      location.hash = '#stories'
      hooks.render()
      return
    }
    let completed = false
    let existingId = ''
    await hooks.act(async () => {
      const result = await followStory(client(), hooks.userId(), video.id, name, aliases)
      existingId = result.existing ? result.id : ''
      completed = true
    })
    if (!completed) return
    if (existingId && confirm(`Adicionar este vídeo à história existente “${name.trim()}”?`)) {
      await hooks.act(async () => {
        await attachStoryVideo(client(), existingId, video.id)
      })
    }
    location.hash = '#stories'
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
