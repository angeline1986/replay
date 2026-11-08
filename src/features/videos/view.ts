import { button, element, notice } from '../../shared/dom.ts'
import { filterVideos, validVideoUrl, type Channel, type Video, type VideoFilter } from '../../shared/model.ts'
import { iconButton } from './icons.ts'
import { favoriteVideoGroups } from './favorites.ts'

interface VideoViewOptions {
  mode: 'favorites' | 'videos' | 'deprioritized' | 'queue'
  videos: Video[]
  highlights?: Video[]
  favoriteVideos?: Video[]
  collectionVideos?: Video[]
  channels: Channel[]
  filter: VideoFilter
  sort: 'recent' | 'az'
  hasMore: boolean
  onFilter: (next: VideoFilter) => void
  onSort: (next: 'recent' | 'az') => void
  onToggle: (video: Video, key: 'is_favorite' | 'is_watched' | 'is_deprioritized' | 'is_queued') => void
  onFollow: (video: Video) => void
  trackedVideoIds: Set<string>
  onLoadMore: () => void
}

export function videoView(options: VideoViewOptions): HTMLElement {
  const root = element('section', 'content')
  const favorites = options.mode === 'favorites'
  const collection = options.mode !== 'videos'
  const collectionTitle = options.mode === 'deprioritized' ? 'Despriorizados'
    : options.mode === 'queue' ? 'Fila de espera' : 'Vídeos favoritos'
  const heading = element('div', 'favorites-toolbar')
  const intro = element('div', 'favorite-page-title')
  const favoriteSource = options.favoriteVideos ?? options.videos
  const title = collection ? collectionTitle : 'Últimos lançamentos'
  const countSource = collection ? (options.collectionVideos ?? favoriteSource) : options.videos
  const countBadge = element('span', 'favorite-total', String(countSource.length))
  intro.append(element('h1', '', title), countBadge)
  const add = element('a', 'primary header-action', 'Add Canal')
  add.href = '#channels'
  heading.append(intro)

  const filters = element('div', 'favorite-toolbar-controls')
  const search = element('input')
  search.type = 'search'
  search.placeholder = '⌕  Vídeo ou canal...'
  search.setAttribute('aria-label', 'Vídeo ou canal')
  search.value = options.filter.query
  search.addEventListener('input', () => options.onFilter({ ...options.filter, query: search.value }))
  filters.append(search)
  const status = element('select', 'favorite-status')
  status.setAttribute('aria-label', 'Filtrar vídeos por status')
  const collectionLabel = favorites ? 'Favoritos' : options.mode === 'queue' ? 'Fila de espera' : 'Despriorizados'
  const statuses = collection
    ? [['all', collectionLabel], ['unwatched', 'Não vistos']]
    : [['all', 'Lançamentos'], ['new', 'Novos'], ['unwatched', 'Não vistos'], ['favorites', 'Favoritos']]
  for (const [value, label] of statuses) {
    const option = element('option', '', label)
    option.value = value
    status.append(option)
  }
  status.value = options.filter.status
  status.addEventListener('change', () => options.onFilter({
    ...options.filter, status: status.value as VideoFilter['status']
  }))
  filters.append(status)
  const channel = element('select', 'favorite-channel-filter')
  channel.setAttribute('aria-label', 'Filtrar vídeos por canal')
  const allChannels = element('option', '', 'Canais')
  allChannels.value = ''
  channel.append(allChannels)
  const channelSource = options.collectionVideos ?? favoriteSource
  const favoriteChannelIds = new Set(channelSource.map((video) => video.channel_id))
  const availableChannels = collection
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
  const sort = element('select', 'favorite-sort')
  sort.setAttribute('aria-label', 'Ordenar vídeos')
  for (const [value, label] of [['recent', 'Recentes'], ['az', 'Título A–Z']]) {
    const option = element('option', '', label)
    option.value = value
    sort.append(option)
  }
  sort.value = options.sort
  sort.addEventListener('change', () => options.onSort(sort.value as VideoViewOptions['sort']))
  filters.append(sort)
  filters.append(add)
  heading.append(filters)
  root.append(heading)

  // Com ambos os selects em "Todos", mostrar apenas o último vídeo de cada canal.
  const onePerChannel = !collection && options.filter.status === 'all' && !options.filter.channelId
  const source = collection ? (options.collectionVideos ?? options.favoriteVideos ?? options.videos)
    : onePerChannel ? (options.highlights ?? options.videos) : options.videos
  const filtered = filterVideos(source, options.filter)
    .filter((video) => options.mode !== 'favorites' || video.state?.is_favorite)
    .filter((video) => options.mode !== 'deprioritized' || video.state?.is_deprioritized)
    .filter((video) => options.mode !== 'queue' || video.state?.is_queued)
  if (options.sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  countBadge.textContent = String(filtered.length)
  if (!filtered.length) {
    const empty = options.mode === 'deprioritized' ? 'Nenhum vídeo despriorizado ainda.'
      : options.mode === 'queue' ? 'Sua fila de espera está vazia.'
        : favorites ? 'Nenhum favorito encontrado. Marque um vídeo no feed para vê-lo aqui.'
          : 'Nenhum vídeo encontrado. Ajuste os filtros ou cadastre um canal.'
    root.append(notice(empty))
  } else if (collection) {
    root.append(favoriteVideoGroups(filtered, options.channels, options.sort, (video) => videoCard(video, options)))
  } else {
    const grid = element('div', 'video-grid')
    for (const video of filtered) grid.append(videoCard(video, options))
    root.append(grid)
  }
  if (options.hasMore && !onePerChannel && !collection) root.append(button('Carregar mais vídeos', options.onLoadMore, 'load-more'))
  return root
}

function videoCard(
  video: Video,
  options: VideoViewOptions
): HTMLElement {
  const card = element('article', options.mode !== 'videos' ? 'video-card favorite-video-card' : 'video-card')
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
  const deprioritized = Boolean(video.state?.is_deprioritized)
  const queued = Boolean(video.state?.is_queued)
  const follow = iconButton(following ? 'História já acompanhada' : 'Acompanhar esta história',
    'runner', () => options.onFollow(video), following)
  follow.disabled = following
  actions.append(
    iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
      'star', () => options.onToggle(video, 'is_favorite'), favorite),
    iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto',
      watched ? 'eye' : 'eye-slash', () => options.onToggle(video, 'is_watched'), watched),
    follow,
    iconButton(queued ? 'Remover da fila de espera' : 'Adicionar à fila de espera',
      'hourglass', () => options.onToggle(video, 'is_queued'), queued),
    iconButton(deprioritized ? 'Remover dos despriorizados' : 'Despriorizar vídeo',
      'heart-crack', () => options.onToggle(video, 'is_deprioritized'), deprioritized)
  )
  actions.append(link)
  body.append(actions)
  card.append(body)
  return card
}
