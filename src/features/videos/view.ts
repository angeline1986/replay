import { button, element, notice } from '../../shared/dom.ts'
import { filterVideos, validVideoUrl, type Channel, type Video, type VideoFilter } from '../../shared/model.ts'

interface VideoViewOptions {
  videos: Video[]
  channels: Channel[]
  filter: VideoFilter
  hasMore: boolean
  onFilter: (next: VideoFilter) => void
  onToggle: (video: Video, key: 'is_favorite' | 'is_watched') => void
  onLoadMore: () => void
}

export function videoView(options: VideoViewOptions): HTMLElement {
  const root = element('section', 'content')
  const heading = element('div', 'section-heading')
  heading.append(element('div'))
  heading.firstElementChild?.append(element('p', 'eyebrow', 'SEU FEED'), element('h1', '', 'Vídeos recentes'))
  heading.append(element('p', 'muted', 'Atualizações dos canais que você escolheu.'))
  root.append(heading)

  const filters = element('div', 'filters')
  const search = element('input')
  search.type = 'search'
  search.placeholder = 'Buscar por vídeo ou canal'
  search.setAttribute('aria-label', 'Buscar por vídeo ou canal')
  search.value = options.filter.query
  search.addEventListener('input', () => options.onFilter({ ...options.filter, query: search.value }))
  filters.append(search)
  const status = element('select')
  status.setAttribute('aria-label', 'Filtrar vídeos por status')
  for (const [value, label] of [
    ['all', 'Todos'], ['new', 'Novos'], ['unwatched', 'Não vistos'], ['favorites', 'Favoritos']
  ]) {
    const option = element('option', '', label)
    option.value = value
    status.append(option)
  }
  status.value = options.filter.status
  status.addEventListener('change', () => options.onFilter({
    ...options.filter, status: status.value as VideoFilter['status']
  }))
  filters.append(status)
  const channel = element('select')
  channel.setAttribute('aria-label', 'Filtrar vídeos por canal')
  channel.append(element('option', '', 'Todos os canais'))
  for (const item of options.channels) {
    const option = element('option', '', item.name)
    option.value = item.id
    channel.append(option)
  }
  channel.value = options.filter.channelId
  channel.addEventListener('change', () => options.onFilter({ ...options.filter, channelId: channel.value }))
  filters.append(channel)
  root.append(filters)

  const filtered = filterVideos(options.videos, options.filter)
  root.append(element('p', 'result-count', `${filtered.length} vídeo${filtered.length === 1 ? '' : 's'}`))
  if (!filtered.length) {
    root.append(notice('Nenhum vídeo encontrado. Ajuste os filtros ou cadastre um canal.'))
  } else {
    const grid = element('div', 'video-grid')
    for (const video of filtered) grid.append(videoCard(video, options.onToggle))
    root.append(grid)
  }
  if (options.hasMore) root.append(button('Carregar mais vídeos', options.onLoadMore, 'load-more'))
  return root
}

function videoCard(
  video: Video,
  onToggle: VideoViewOptions['onToggle']
): HTMLElement {
  const card = element('article', 'video-card')
  const image = element('div', 'video-art')
  if (video.thumbnail_url) {
    const img = element('img')
    img.src = video.thumbnail_url
    img.alt = ''
    img.loading = 'lazy'
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('error', () => img.remove())
    image.append(img)
  }
  image.append(element('span', 'play-mark', '▶'))
  card.append(image)
  const body = element('div', 'video-body')
  const meta = element('p', 'video-meta', `${video.channel?.name ?? 'Canal'} · ${new Date(video.published_at).toLocaleDateString('pt-BR')}`)
  const title = element('h2', '', video.title)
  const link = element('a', 'video-link', 'Assistir no YouTube ↗')
  link.href = validVideoUrl(video.youtube_video_id)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  body.append(meta)
  if (!video.state) body.append(element('span', 'new-badge', 'Novo'))
  body.append(title, link)
  const actions = element('div', 'card-actions')
  actions.append(
    button(video.state?.is_favorite ? '★ Favorito' : '☆ Favoritar', () => onToggle(video, 'is_favorite')),
    button(video.state?.is_watched ? '✓ Visto' : '○ Marcar visto', () => onToggle(video, 'is_watched'))
  )
  body.append(actions)
  card.append(body)
  return card
}
