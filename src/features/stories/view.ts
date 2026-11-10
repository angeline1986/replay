import { button, element, notice } from '../../shared/dom.ts'
import { iconButton } from '../videos/icons.ts'
import { validVideoUrl, type Channel, type Video } from '../../shared/model.ts'
import { storyChannelGroups, storyChannelId } from './groups.ts'
import { storyToolbar } from './toolbar.ts'
import { youtubeSearchView } from '../videos/youtube-search.ts'
import { findVideoMenu, type FindVideoOptions } from '../videos/find-menu.ts'
import type { YouTubeLookupResult, YouTubeResult } from '../../shared/saved-youtube.ts'
import type { StoryDashboard, TrackedStory } from '../../shared/story-model.ts'

interface StoryViewOptions {
  data: StoryDashboard
  mode?: 'active' | 'completed'
  channels?: Channel[]
  selectedChannelId: string
  onChannelSelect: (id: string) => void
  query: string
  onQuery: (value: string) => void
  sort: 'recent' | 'az' | 'sequence'
  onSort: (value: 'recent' | 'az' | 'sequence') => void
  onLookupYouTube: (input: string) => Promise<YouTubeLookupResult>
  onSaveYouTube: (video: YouTubeResult) => void
  onToggleVideo: (video: Video, key: 'is_favorite' | 'is_watched') => void
  onOpenSequence: (story: TrackedStory) => void
  onComplete: (story: TrackedStory, completed: boolean) => void
  onUnfollow?: (story: TrackedStory) => void
  finder?: FindVideoOptions
}

function videoActions(video: Video | null, story: TrackedStory, options: StoryViewOptions): HTMLElement {
  const actions = element('div', 'card-actions follow-video-actions')
  const completed = options.mode === 'completed'
  const runner = iconButton(completed ? 'Retomar acompanhamento' : 'Deixar de acompanhar esta história',
    'runner', () => completed ? options.onComplete(story, false) : options.onUnfollow?.(story), !completed)
  runner.disabled = !completed && !options.onUnfollow
  actions.append(runner)
  if (video) {
    const favorite = Boolean(video.state?.is_favorite)
    const watched = Boolean(video.state?.is_watched)
    actions.append(iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos', 'star',
      () => options.onToggleVideo(video, 'is_favorite'), favorite),
      iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto', watched ? 'eye' : 'eye-slash',
        () => options.onToggleVideo(video, 'is_watched'), watched))
  }
  actions.append(iconButton(completed ? 'Desmarcar conclusão' : 'Concluir história', 'check-double',
    () => options.onComplete(story, !completed), completed))
  return actions
}

function storyCard(group: StoryDashboard['groups'][number], options: StoryViewOptions): HTMLElement {
  const card = element('article', 'follow-card')
  card.dataset.storyId = group.story.id
  const cover = group.seed ?? group.confirmed[0]?.video ?? null
  const hero = cover ? element('a', 'follow-hero') : element('div', 'follow-hero')
  if (cover) {
    const link = hero as HTMLAnchorElement
    link.href = validVideoUrl(cover.youtube_video_id)
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = 'Abrir vídeo no YouTube'
    link.setAttribute('aria-label', link.title)
  }
  if (cover?.thumbnail_url) {
    const img = element('img')
    img.src = cover.thumbnail_url
    img.alt = ''
    img.loading = 'lazy'
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('error', () => img.remove())
    hero.append(img)
  }
  hero.append(element('span', 'follow-play', '▶'))
  card.append(hero)
  const info = element('div', 'follow-info')
  info.append(element('h2', '', group.story.name))
  info.append(element('p', 'video-meta',
    `${cover?.channel?.name ?? 'Canal'} · ${cover ? new Date(cover.published_at).toLocaleDateString('pt-BR') : 'Sem vídeo'}`))
  const tags = element('div', 'follow-tags')
  tags.append(videoActions(cover, group.story, options))
  info.append(tags)
  card.append(info)
  const footer = element('div', 'follow-footer')
  const continuations = group.confirmed.length + group.pending.length
  if (continuations) footer.append(button(`Ver sequência (+${continuations})`,
    () => options.onOpenSequence(group.story), 'follow-expand'))
  if (footer.childElementCount) card.append(footer)
  return card
}

export function storiesView(options: StoryViewOptions): HTMLElement {
  const source = options.mode === 'completed' ? options.data.completed : options.data.groups
  const query = options.mode === 'completed' ? options.query.trim().toLocaleLowerCase('pt-BR') : ''
  const visible = source.filter((group) => {
    if (options.mode !== 'completed' && options.sort === 'sequence' &&
      group.confirmed.length + group.pending.length === 0) return false
    if (options.selectedChannelId && storyChannelId(group) !== options.selectedChannelId) return false
    const channel = options.channels?.find((item) => item.id === storyChannelId(group))
    const titles = [group.seed?.title, ...group.confirmed.map((item) => item.video.title)].filter(Boolean)
    return !query || `${group.story.name} ${channel?.name ?? ''} ${titles.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query)
  })
  const latest = (group: StoryDashboard['groups'][number]) => Math.max(
    Date.parse(group.seed?.published_at ?? '') || 0,
    ...group.confirmed.map((item) => Date.parse(item.video.published_at) || 0))
  visible.sort((a, b) => options.sort === 'az' ? a.story.name.localeCompare(b.story.name, 'pt-BR')
    : options.mode === 'completed' ? Date.parse(b.story.completed_at ?? '') - Date.parse(a.story.completed_at ?? '')
      : latest(b) - latest(a) || Date.parse(b.story.created_at) - Date.parse(a.story.created_at))
  const root = element('section', 'content')
  const heading = element('div', 'favorites-toolbar')
  const title = element('div', 'favorite-page-title')
  title.append(element('h1', '', options.mode === 'completed' ? 'Concluídos' : 'Minhas histórias'),
    element('span', 'favorite-total', String(visible.length)))
  heading.append(title)
  heading.append(storyToolbar({ source, channels: options.channels ?? [], completed: options.mode === 'completed',
    selectedChannelId: options.selectedChannelId, onChannelSelect: options.onChannelSelect,
    query: options.query, onQuery: options.onQuery, sort: options.sort, onSort: options.onSort }))
  if (options.mode !== 'completed' && options.finder) heading.append(findVideoMenu(options.finder))
  root.append(heading)
  if (options.mode === 'completed') root.append(youtubeSearchView('completed', options.onLookupYouTube, options.onSaveYouTube))
  if (!source.length) {
    root.append(notice(options.mode === 'completed' ? 'Nenhuma história concluída.' :
      'Você ainda não acompanha histórias. Use “Acompanhar esta história” em um vídeo.'))
    return root
  }
  if (!visible.length) { root.append(notice('Nenhuma história encontrada. Ajuste os filtros.')); return root }
  root.append(storyChannelGroups(visible, options.channels ?? [], (group) => storyCard(group, options)))
  return root
}
