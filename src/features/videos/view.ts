import { button, element, notice } from '../../shared/dom.ts'
import { filterVideos, validVideoUrl, type Channel, type Video, type VideoFilter } from '../../shared/model.ts'
import { iconButton } from './icons.ts'
import { favoriteVideoGroups } from './favorites.ts'
import { findVideoMenu, type FindVideoOptions } from './find-menu.ts'
import { channelPicker } from '../../shared/channel-picker.ts'
import { selectPicker, type SelectChoice } from '../../shared/select-picker.ts'

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
  onUnfollow?: (video: Video) => void
  trackedVideoIds: Set<string>
  onLoadMore: () => void
  onToggleSaved?: (video: Video, key: 'is_queued' | 'is_deprioritized') => void
  finder?: FindVideoOptions
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
  const title = collection ? collectionTitle : 'Lançamentos'
  const countSource = collection ? (options.collectionVideos ?? favoriteSource) : options.videos
  const countBadge = element('span', 'favorite-total', String(countSource.length))
  intro.append(element('h1', '', title), countBadge)
  heading.append(intro)

  const filters = element('div', 'favorite-toolbar-controls')
  if (options.mode === 'videos') {
    const search = element('input')
    search.type = 'search'
    search.placeholder = '⌕  Buscar vídeo...'
    search.setAttribute('aria-label', 'Buscar vídeo')
    search.value = options.filter.query
    search.addEventListener('input', () => options.onFilter({ ...options.filter, query: search.value }))
    filters.append(search)
  }
  if (options.mode === 'favorites' || options.mode === 'videos') {
    const statuses: SelectChoice<VideoFilter['status']>[] = favorites
      ? [{ value: 'all', label: 'Favoritos' }, { value: 'unwatched', label: 'Não vistos' }]
      : [{ value: 'all', label: 'Tipo' }, { value: 'new', label: 'Novos' },
        { value: 'unwatched', label: 'Não vistos' }, { value: 'favorites', label: 'Favoritos' },
        ...(options.filter.channelId ? [{ value: 'marked' as const, label: 'Marcados' }] : [])]
    filters.append(selectPicker({ choices: statuses, value: options.filter.status,
      label: 'Filtrar vídeos por status', className: 'favorite-status',
      onChange: (status) => options.onFilter({ ...options.filter, status }) }))
  }
  const channelSource = options.collectionVideos ?? favoriteSource
  const favoriteChannelIds = new Set(channelSource.map((video) => video.channel_id))
  const availableChannels = collection
    ? options.channels.filter((item) => favoriteChannelIds.has(item.id))
    : options.channels
  const choices: Pick<Channel, 'id' | 'name' | 'is_top'>[] = [...availableChannels]
  if (options.mode === 'queue' || options.mode === 'deprioritized') {
    for (const video of channelSource.filter((item) => item.external)) {
      if (choices.some((item) => item.id === video.channel_id)) continue
      const monitored = options.channels.find((item) => item.youtube_channel_id === video.channel_id)
      choices.push({ id: video.channel_id, name: video.channel?.name ?? 'Canal', is_top: Boolean(monitored?.is_top) })
    }
  }
  filters.append(channelPicker({ channels: choices, value: options.filter.channelId,
    placeholder: 'Canais', label: 'Filtrar vídeos por canal', className: 'favorite-channel-filter',
    onChange: (id) => options.onFilter({ ...options.filter, channelId: id }) }))
  filters.append(selectPicker({
    choices: [{ value: 'recent', label: 'Recentes' }, { value: 'az', label: 'Título A–Z' }],
    value: options.sort, label: 'Ordenar vídeos', className: 'favorite-sort',
    title: options.mode === 'queue' ? 'Recentes = adicionados por último à fila' : undefined,
    onChange: options.onSort
  }))
  if (options.finder) filters.append(findVideoMenu(options.finder))
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
  const recentAt = (video: Video) => recentDate(video, options.mode)
  if (options.sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  else filtered.sort((a, b) => Date.parse(recentAt(b)) - Date.parse(recentAt(a)))
  countBadge.textContent = String(filtered.length)
  if (!filtered.length) {
    const empty = options.mode === 'deprioritized' ? 'Nenhum vídeo despriorizado ainda.'
      : options.mode === 'queue' ? 'Sua fila de espera está vazia.'
        : favorites ? 'Nenhum favorito encontrado. Marque um vídeo no feed para vê-lo aqui.'
          : 'Nenhum vídeo encontrado. Ajuste os filtros ou cadastre um canal.'
    root.append(notice(empty))
  } else if (collection) {
    root.append(favoriteVideoGroups(filtered, options.channels, options.sort,
      (video) => videoCard(video, options), recentAt))
  } else {
    const grid = element('div', 'video-grid')
    for (const video of filtered) grid.append(videoCard(video, options))
    root.append(grid)
  }
  if (options.hasMore && !onePerChannel && !collection) root.append(button('Carregar mais vídeos', options.onLoadMore, 'load-more'))
  return root
}

function recentDate(video: Video, mode: VideoViewOptions['mode']): string {
  if (mode === 'queue') return video.state?.queued_at ?? video.published_at
  if (mode === 'favorites') return video.state?.favorited_at ?? video.published_at
  if (mode === 'deprioritized') return video.state?.deprioritized_at ?? video.published_at
  return video.published_at
}

function videoCard(
  video: Video,
  options: VideoViewOptions
): HTMLElement {
  const card = element('article', options.mode !== 'videos' ? 'video-card favorite-video-card' : 'video-card')
  card.dataset.youtubeVideoId = video.youtube_video_id
  const image = element('a', 'video-art')
  image.href = validVideoUrl(video.youtube_video_id)
  image.target = '_blank'
  image.rel = 'noopener noreferrer'
  image.title = 'Abrir vídeo no YouTube'
  image.setAttribute('aria-label', image.title)
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
  if (!video.state) image.append(element('span', 'new-badge', 'Novo'))
  card.append(image)
  const body = element('div', 'video-body')
  const meta = element('p', 'video-meta', `${video.channel?.name ?? 'Canal'} · ${new Date(video.published_at).toLocaleDateString('pt-BR')}`)
  const title = element('h2', '', video.title)
  body.append(title, meta)
  const actions = element('div', 'card-actions')
  const following = options.trackedVideoIds.has(video.id)
  const favorite = Boolean(video.state?.is_favorite)
  const watched = Boolean(video.state?.is_watched)
  const deprioritized = Boolean(video.state?.is_deprioritized)
  const queued = Boolean(video.state?.is_queued)
  const follow = iconButton(following ? 'Deixar de acompanhar esta história' : 'Acompanhar esta história',
    'runner', () => following ? options.onUnfollow?.(video) : options.onFollow(video), following)
  follow.disabled = following && !options.onUnfollow
  actions.append(
    iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
      'star', () => options.onToggle(video, 'is_favorite'), favorite),
    iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto',
      watched ? 'eye' : 'eye-slash', () => options.onToggle(video, 'is_watched'), watched),
    follow,
    iconButton(queued ? 'Remover da fila de espera' : 'Adicionar à fila de espera',
      'hourglass', () => video.external ? options.onToggleSaved?.(video, 'is_queued')
        : options.onToggle(video, 'is_queued'), queued),
    iconButton(deprioritized ? 'Remover dos despriorizados' : 'Despriorizar vídeo',
      'heart-crack', () => video.external ? options.onToggleSaved?.(video, 'is_deprioritized')
        : options.onToggle(video, 'is_deprioritized'), deprioritized)
  )
  body.append(actions)
  card.append(body)
  return card
}
