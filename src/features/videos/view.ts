import { button, element, notice } from '../../shared/dom.ts'
import { filterVideos, validVideoUrl, type Channel, type Video, type VideoFilter } from '../../shared/model.ts'
import { statsView } from '../stats/view.ts'
import { iconButton } from './icons.ts'
import { favoriteVideoGroups } from './favorites.ts'

interface VideoViewOptions {
  mode: 'favorites' | 'videos'
  videos: Video[]
  highlights?: Video[]
  favoriteVideos?: Video[]
  channels: Channel[]
  filter: VideoFilter
  sort: 'recent' | 'az'
  hasMore: boolean
  onFilter: (next: VideoFilter) => void
  onSort: (next: 'recent' | 'az') => void
  onToggle: (video: Video, key: 'is_favorite' | 'is_watched') => void
  onFollow: (video: Video) => void
  trackedVideoIds: Set<string>
  onLoadMore: () => void
}

export function videoView(options: VideoViewOptions): HTMLElement {
  const root = element('section', 'content')
  const favorites = options.mode === 'favorites'
  const heading = element('div', favorites ? 'favorites-toolbar' : 'page-head')
  const intro = element('div')
  const favoriteSource = options.favoriteVideos ?? options.videos
  if (favorites) {
    const title = element('div', 'favorite-page-title')
    title.append(element('h1', '', 'Vídeos favoritos'))
    title.append(element('span', 'favorite-total', String(favoriteSource.filter((video) => video.state?.is_favorite).length)))
    intro.append(title)
  } else {
    intro.append(
      element('p', 'eyebrow', 'FEED GERAL'),
      element('h1', '', 'Últimos lançamentos'),
      element('p', 'subtitle', 'Novos vídeos dos canais que você monitora.')
    )
  }
  const add = element('a', 'primary header-action', 'Add Canal')
  add.href = '#channels'
  heading.append(intro)

  const filters = element('div', favorites ? 'favorite-toolbar-controls' : 'filters')
  const search = element('input')
  search.type = 'search'
  search.placeholder = favorites ? '⌕  Buscar vídeo ou canal...' : 'Buscar por vídeo ou canal'
  search.setAttribute('aria-label', 'Buscar por vídeo ou canal')
  search.value = options.filter.query
  search.addEventListener('input', () => options.onFilter({ ...options.filter, query: search.value }))
  filters.append(search)
  const status = element('select', favorites ? 'favorite-status' : '')
  status.setAttribute('aria-label', 'Filtrar vídeos por status')
  const statuses = favorites
    ? [['all', 'Todos os favoritos'], ['unwatched', 'Não vistos']]
    : [['all', 'Todos os lançamentos'], ['new', 'Novos'], ['unwatched', 'Não vistos'], ['favorites', 'Favoritos']]
  for (const [value, label] of statuses) {
    const option = element('option', '', label)
    option.value = value
    status.append(option)
  }
  status.value = options.filter.status
  status.addEventListener('change', () => options.onFilter({
    ...options.filter, status: status.value as VideoFilter['status']
  }))
  if (!favorites) filters.append(status)
  const channel = element('select')
  channel.setAttribute('aria-label', 'Filtrar vídeos por canal')
  const allChannels = element('option', '', 'Todos os canais')
  allChannels.value = ''
  channel.append(allChannels)
  const favoriteChannelIds = new Set(favoriteSource
    .filter((video) => video.state?.is_favorite).map((video) => video.channel_id))
  const availableChannels = favorites
    ? options.channels.filter((item) => favoriteChannelIds.has(item.id))
    : options.channels
  for (const item of availableChannels) {
    const option = element('option', '', item.name)
    option.value = item.id
    channel.append(option)
  }
  channel.value = options.filter.channelId
  channel.addEventListener('change', () => options.onFilter({ ...options.filter, channelId: channel.value }))
  filters.append(channel)
  const sort = element('select')
  sort.setAttribute('aria-label', 'Ordenar vídeos')
  for (const [value, label] of [['recent', favorites ? 'Recentes' : 'Mais recentes'], ['az', 'Título A–Z']]) {
    const option = element('option', '', label)
    option.value = value
    sort.append(option)
  }
  sort.value = options.sort
  sort.addEventListener('change', () => options.onSort(sort.value as VideoViewOptions['sort']))
  filters.append(sort)
  if (favorites) {
    filters.append(add)
    heading.append(filters)
    root.append(heading)
  } else {
    heading.append(add)
    root.append(heading, statsView(options.channels, options.videos, options.favoriteVideos?.length), filters)
  }

  // Com ambos os selects em "Todos", mostrar apenas o último vídeo de cada canal.
  const onePerChannel = !favorites && options.filter.status === 'all' && !options.filter.channelId
  const source = favorites ? (options.favoriteVideos ?? options.videos)
    : onePerChannel ? (options.highlights ?? options.videos) : options.videos
  const filtered = filterVideos(source, options.filter)
    .filter((video) => !favorites || video.state?.is_favorite)
  if (options.sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  const sectionTitle = element('div', 'section-title')
  sectionTitle.append(
    element('h2', '', favorites ? 'Minha seleção' : 'Publicações recentes'),
    ...(favorites ? [status] : []),
    element('span', 'result-count', `${filtered.length} vídeo${filtered.length === 1 ? '' : 's'}`)
  )
  if (favorites) sectionTitle.classList.add('favorite-section-title')
  root.append(sectionTitle)
  if (!filtered.length) {
    root.append(notice(favorites
      ? 'Nenhum favorito encontrado. Marque um vídeo no feed para vê-lo aqui.'
      : 'Nenhum vídeo encontrado. Ajuste os filtros ou cadastre um canal.'))
  } else if (favorites) {
    root.append(favoriteVideoGroups(filtered, options.channels, options.sort, (video) => videoCard(video, options)))
  } else {
    const grid = element('div', 'video-grid')
    for (const video of filtered) grid.append(videoCard(video, options))
    root.append(grid)
  }
  if (options.hasMore && !onePerChannel && !favorites) root.append(button('Carregar mais vídeos', options.onLoadMore, 'load-more'))
  return root
}

function videoCard(
  video: Video,
  options: VideoViewOptions
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
  const link = element('a', 'video-link', 'Abrir ↗')
  link.href = validVideoUrl(video.youtube_video_id)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  if (!video.state) body.append(element('span', 'new-badge', 'Novo'))
  body.append(title, meta)
  const actions = element('div', 'card-actions')
  const following = options.trackedVideoIds.has(video.id)
  const favorite = Boolean(video.state?.is_favorite)
  const watched = Boolean(video.state?.is_watched)
  const follow = iconButton(following ? 'História já acompanhada' : 'Acompanhar esta história',
    'runner', () => options.onFollow(video), following)
  follow.disabled = following
  actions.append(
    iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
      'star', () => options.onToggle(video, 'is_favorite'), favorite),
    iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto',
      watched ? 'eye' : 'eye-slash', () => options.onToggle(video, 'is_watched'), watched),
    follow
  )
  actions.append(link)
  body.append(actions)
  card.append(body)
  return card
}
