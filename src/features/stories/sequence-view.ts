import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Video } from '../../shared/model.ts'
import { parseStoryPosition } from '../../shared/story-match.ts'
import { iconButton } from '../videos/icons.ts'
import type { StoryCandidate, StoryDashboard, StoryGroup, TrackedStory } from '../../shared/story-model.ts'

interface SequenceOptions {
  data: StoryDashboard
  id: string
  onBack: () => void
  onUnfollow: (story: TrackedStory) => void
  onToggle: (video: Video, key: 'is_favorite' | 'is_watched' | 'is_queued' | 'is_deprioritized') => void
  onDecide: (candidate: StoryCandidate, status: 'confirmed' | 'rejected') => void
}

function byChapter(a: Video, b: Video): number {
  const first = parseStoryPosition(a.title)
  const second = parseStoryPosition(b.title)
  if (first && second && first.kind === second.kind) return first.first - second.first
  return Date.parse(a.published_at) - Date.parse(b.published_at)
}

function sequenceCard(video: Video, options: SequenceOptions,
  candidate?: StoryCandidate): HTMLElement {
  const card = element('article', `video-card sequence-card${candidate ? ' is-pending' : ''}`)
  const art = element('a', 'video-art')
  art.href = validVideoUrl(video.youtube_video_id)
  art.target = '_blank'
  art.rel = 'noopener noreferrer'
  art.title = 'Abrir vídeo no YouTube'
  art.setAttribute('aria-label', art.title)
  if (video.thumbnail_url) {
    const image = element('img')
    image.src = video.thumbnail_url
    image.alt = ''
    image.loading = 'lazy'
    image.referrerPolicy = 'no-referrer'
    image.addEventListener('error', () => image.remove())
    art.append(image)
  }
  art.append(element('span', 'play-mark', '▶'))
  if (!video.state) art.append(element('span', 'new-badge', 'Novo'))
  const body = element('div', 'video-body')
  const title = element('h2', '', video.title)
  const meta = element('p', 'video-meta', `${video.channel?.name ?? 'Canal'} · ${new Date(video.published_at).toLocaleDateString('pt-BR')}`)
  const actions = element('div', 'card-actions')
  const favorite = Boolean(video.state?.is_favorite)
  const watched = Boolean(video.state?.is_watched)
  const queued = Boolean(video.state?.is_queued)
  const deprioritized = Boolean(video.state?.is_deprioritized)
  const follow = iconButton('História já acompanhada', 'runner', () => {}, true)
  follow.disabled = true
  actions.append(
    iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos', 'star',
      () => options.onToggle(video, 'is_favorite'), favorite),
    iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto', watched ? 'eye' : 'eye-slash',
      () => options.onToggle(video, 'is_watched'), watched), follow,
    iconButton(queued ? 'Remover da fila de espera' : 'Adicionar à fila de espera', 'hourglass',
      () => options.onToggle(video, 'is_queued'), queued),
    iconButton(deprioritized ? 'Remover dos despriorizados' : 'Despriorizar vídeo', 'heart-crack',
      () => options.onToggle(video, 'is_deprioritized'), deprioritized)
  )
  body.append(title, meta, actions)
  card.append(art, body)
  if (candidate) {
    const decision = element('div', 'sequence-decision')
    decision.append(element('p', 'video-meta', `Confiança ${candidate.score >= 85 ? 'alta' : 'média'}`),
      button('Confirmar', () => options.onDecide(candidate, 'confirmed'), 'primary'),
      button('Rejeitar', () => options.onDecide(candidate, 'rejected'), 'ghost'))
    card.append(decision)
  }
  return card
}

function groupSection(title: string, cards: HTMLElement[]): HTMLElement {
  const section = element('section', 'sequence-section')
  const heading = element('div', 'section-title')
  heading.append(element('h2', '', title), element('span', 'result-count', `${cards.length} vídeo${cards.length === 1 ? '' : 's'}`))
  const grid = element('div', 'video-grid')
  grid.append(...cards)
  section.append(heading, grid)
  return section
}

export function sequenceView(options: SequenceOptions): HTMLElement {
  const root = element('section', 'content sequence-view')
  const group: StoryGroup | undefined = [...options.data.groups, ...options.data.completed]
    .find((item) => item.story.id === options.id)
  const heading = element('div', 'favorites-toolbar')
  const intro = element('div', 'favorite-page-title')
  const total = group ? Number(Boolean(group.seed)) + group.confirmed.length + group.pending.length : 0
  intro.append(element('h1', '', 'Lançamentos'), element('span', 'favorite-total', String(total)))
  const controls = element('div', 'favorite-toolbar-controls sequence-toolbar-actions')
  controls.append(button('← Minhas histórias', options.onBack, 'ghost'))
  if (group?.story.is_followed) controls.append(button('Deixar de acompanhar',
    () => options.onUnfollow(group.story), 'ghost sequence-unfollow'))
  heading.append(intro, controls)
  root.append(heading)
  if (!group) { root.append(notice('História não encontrada. Volte para Minhas histórias.')); return root }
  const confirmed = [group.seed, ...group.confirmed.map((item) => item.video)]
    .filter((video): video is Video => Boolean(video)).sort(byChapter)
  const confirmedGrid = element('div', 'video-grid')
  confirmedGrid.append(...confirmed.map((video) => sequenceCard(video, options)))
  root.append(confirmedGrid)
  if (group.story.is_followed) {
    const pending = [...group.pending].sort((a, b) => byChapter(a.video, b.video))
    if (pending.length) root.append(groupSection('Possíveis continuações', pending.map((item) =>
      sequenceCard(item.video, options, item))))
  }
  return root
}
