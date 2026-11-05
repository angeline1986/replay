import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Video } from '../../shared/model.ts'
import type { StoryCandidate, StoryDashboard, TrackedStory } from '../../shared/story-model.ts'

interface StoryViewOptions {
  data: StoryDashboard
  onDecide: (candidate: StoryCandidate, status: 'confirmed' | 'rejected') => void
  onRename: (story: TrackedStory) => void
  onUnfollow: (story: TrackedStory) => void
}

function videoItem(video: Video, label = ''): HTMLElement {
  const row = element('div', 'story-video')
  const link = element('a', '', video.title)
  link.href = validVideoUrl(video.youtube_video_id)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  row.append(link, element('p', 'muted small',
    `${label}${video.channel?.name ?? 'Canal'} · ${new Date(video.published_at).toLocaleDateString('pt-BR')}`))
  return row
}

function candidateItem(candidate: StoryCandidate, options: StoryViewOptions): HTMLElement {
  const row = element('div', 'story-candidate')
  row.append(videoItem(candidate.video))
  row.append(element('p', 'muted small',
    `Confiança ${candidate.score >= 85 ? 'alta' : 'média'} · ${candidate.reason}`))
  const actions = element('div', 'card-actions')
  actions.append(
    button('Confirmar continuação', () => options.onDecide(candidate, 'confirmed')),
    button('Rejeitar sugestão', () => options.onDecide(candidate, 'rejected'), 'ghost')
  )
  row.append(actions)
  return row
}

export function storiesView(options: StoryViewOptions): HTMLElement {
  const root = element('section', 'content')
  const heading = element('div', 'page-head')
  const intro = element('div')
  intro.append(element('p', 'eyebrow', 'SUAS LEITURAS'),
    element('h1', '', 'Minhas histórias'),
    element('p', 'subtitle', 'Continuações sugeridas só entram na história após sua confirmação.'))
  heading.append(intro)
  root.append(heading)
  if (!options.data.groups.length) {
    root.append(notice('Você ainda não acompanha histórias. Use “Acompanhar esta história” em um vídeo.'))
    return root
  }
  root.append(element('p', 'muted', `${options.data.groups.length} história(s) · ` +
    `${options.data.pendingCount} sugestão(ões) pendente(s).`))
  for (const group of options.data.groups) {
    const card = element('article', 'story-card')
    const title = element('div', 'section-title')
    title.append(element('h2', '', group.story.name))
    const actions = element('div', 'bulk-actions')
    actions.append(
      button('Corrigir nome', () => options.onRename(group.story)),
      button('Deixar de acompanhar', () => options.onUnfollow(group.story), 'ghost')
    )
    title.append(actions)
    card.append(title)
    const confirmed = element('div', 'story-confirmed')
    confirmed.append(element('h3', '', 'Vídeos confirmados'))
    if (group.seed) confirmed.append(videoItem(group.seed, 'Vídeo inicial · '))
    for (const item of group.confirmed) confirmed.append(videoItem(item.video))
    if (!group.seed && !group.confirmed.length) {
      confirmed.append(element('p', 'muted', 'Nenhum vídeo confirmado disponível.'))
    }
    card.append(confirmed)
    const pending = element('div', 'story-pending')
    pending.append(element('h3', '', `Possíveis continuações (${group.pending.length})`))
    if (!group.pending.length) pending.append(element('p', 'muted', group.story.last_scanned_at
      ? 'Nenhuma sugestão pendente.' : 'A primeira verificação ocorrerá após a próxima coleta.'))
    for (const item of group.pending) pending.append(candidateItem(item, options))
    card.append(pending)
    root.append(card)
  }
  return root
}
