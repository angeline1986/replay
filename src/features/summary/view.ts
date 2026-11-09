import { element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Channel, type Video } from '../../shared/model.ts'
import type { StoryDashboard } from '../../shared/story-model.ts'
import type { SummaryData, SummaryRow } from './data.ts'
import { iconGlyph, type IconName } from '../videos/icons.ts'
import { channelPicker } from '../../shared/channel-picker.ts'
import { selectPicker, type SelectChoice } from '../../shared/select-picker.ts'

interface SummaryOptions {
  channels: Channel[]
  launchCount: number
  favorites: Video[]
  queued: Video[]
  deprioritized: Video[]
  stories: StoryDashboard
  demoVideos?: Video[]
  load?: () => Promise<SummaryData>
}

function mergeStories(rows: SummaryRow[], stories: StoryDashboard): SummaryRow[] {
  const merged = new Map(rows.map((row) => [row.video.youtube_video_id, row]))
  for (const group of [...stories.groups, ...stories.completed]) {
    for (const video of [group.seed, ...group.confirmed.map((item) => item.video)]) {
      if (!video) continue
      if (!merged.has(video.youtube_video_id)) merged.set(video.youtube_video_id, {
        video, addedAt: group.story.created_at
      })
    }
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
}

interface Mark { label: string; icon: IconName }

function marks(video: Video, stories: StoryDashboard): Mark[] {
  const labels: Mark[] = []
  if (video.state?.is_favorite) labels.push({ label: 'Favorito', icon: 'star' })
  if (video.state?.is_watched) labels.push({ label: 'Visto', icon: 'eye' })
  const includes = (group: StoryDashboard['groups'][number]) =>
    group.seed?.youtube_video_id === video.youtube_video_id ||
    group.confirmed.some((item) => item.video.youtube_video_id === video.youtube_video_id)
  if (stories.groups.some(includes)) labels.push({ label: 'Acompanhando', icon: 'runner' })
  if (video.state?.is_queued) labels.push({ label: 'Fila de espera', icon: 'hourglass' })
  if (video.state?.is_deprioritized) labels.push({ label: 'Despriorizado', icon: 'heart-crack' })
  if (stories.completed.some(includes)) labels.push({ label: 'Concluído', icon: 'check-double' })
  return labels
}

function metrics(options: SummaryOptions, launchCount: number): HTMLElement {
  const grid = element('div', 'summary-metrics')
  const withContinuation = [...options.stories.groups, ...options.stories.completed]
    .filter((group) => group.confirmed.length + group.pending.length > 0).length
  const items: [string, number, string][] = [
    ['Vídeos favoritos', options.favorites.length, '#favorites'],
    ['Minhas histórias', options.stories.groups.length, '#stories'],
    ['Vídeos com continuação', withContinuation, '#stories'],
    ['Canais monitorados', options.channels.length, '#channels'],
    ['Lançamentos', launchCount, '#videos'],
    ['Concluídos', options.stories.completed.length, '#completed'],
    ['Fila de espera', options.queued.length, '#queue'],
    ['Despriorizados', options.deprioritized.length, '#deprioritized']
  ]
  for (const [label, count, href] of items) {
    const card = element('a', 'summary-metric')
    card.href = href
    card.append(element('span', '', label), element('strong', '', String(count)))
    grid.append(card)
  }
  return grid
}

function table(rows: SummaryRow[], options: SummaryOptions): HTMLElement {
  const section = element('section', 'summary-table-section')
  const toolbar = element('div', 'summary-table-toolbar')
  toolbar.setAttribute('aria-label', 'Filtros dos vídeos')
  const channels = new Map<string, Pick<Channel, 'id' | 'name' | 'is_top'>>()
  for (const { video } of rows) {
    const monitored = options.channels.find((item) => item.id === video.channel_id ||
      item.youtube_channel_id === video.channel_id)
    const id = monitored?.id ?? video.channel_id
    channels.set(id, { id, name: monitored?.name ?? video.channel?.name ?? 'Canal',
      is_top: Boolean(monitored?.is_top) })
  }
  let selectedChannel = '', selectedMark: 'all' | IconName = 'all'
  const markChoices: SelectChoice<'all' | IconName>[] = [
    { value: 'all', label: 'Marcações' }, { value: 'star', label: 'Favoritos' },
    { value: 'eye', label: 'Vistos' }, { value: 'runner', label: 'Acompanhando' },
    { value: 'hourglass', label: 'Fila de espera' },
    { value: 'heart-crack', label: 'Despriorizados' },
    { value: 'check-double', label: 'Concluídos' }
  ]
  toolbar.append(channelPicker({ channels: [...channels.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
  value: '', placeholder: 'Canais', label: 'Filtrar tabela por canal',
  className: 'summary-channel-filter', disabled: !rows.length,
  onChange: (id) => { selectedChannel = id; applyFilters() } }),
  selectPicker({ choices: markChoices, value: 'all', label: 'Filtrar tabela por marcação',
    className: 'summary-mark-filter', onChange: (value) => { selectedMark = value; applyFilters() } }))
  section.append(toolbar)
  const scroll = element('div', 'summary-table-scroll')
  const table = element('table', 'summary-table')
  const head = element('thead')
  const header = element('tr')
  for (const label of ['Canal', 'Vídeo', 'Data da adição', 'Marcações']) header.append(element('th', '', label))
  head.append(header)
  const body = element('tbody')
  const entries: { row: HTMLTableRowElement; channelId: string; icons: IconName[] }[] = []
  for (const { video, addedAt } of rows) {
    const row = element('tr')
    const channel = options.channels.find((item) => item.id === video.channel_id ||
      item.youtube_channel_id === video.channel_id)
    row.append(element('td', '', channel?.name ?? video.channel?.name ?? 'Canal'))
    const videoCell = element('td')
    const link = element('a', '', video.title)
    link.href = validVideoUrl(video.youtube_video_id)
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    videoCell.append(link)
    row.append(videoCell, element('td', '', new Date(addedAt).toLocaleDateString('pt-BR')))
    const markCell = element('td')
    const videoMarks = marks(video, options.stories)
    for (const mark of videoMarks) {
      const icon = element('span', `summary-mark-icon summary-mark-${mark.icon}`)
      icon.title = mark.label
      icon.setAttribute('role', 'img')
      icon.setAttribute('aria-label', mark.label)
      icon.append(iconGlyph(mark.icon))
      markCell.append(icon)
    }
    row.append(markCell)
    body.append(row)
    entries.push({ row, channelId: channel?.id ?? video.channel_id,
      icons: videoMarks.map((mark) => mark.icon) })
  }
  table.append(head, body)
  scroll.append(table)
  const empty = notice(rows.length ? 'Nenhum vídeo corresponde aos filtros.' : 'Nenhum vídeo marcado ainda.')
  function applyFilters(): void {
    let visible = 0
    for (const entry of entries) {
      entry.row.hidden = Boolean((selectedChannel && entry.channelId !== selectedChannel) ||
        (selectedMark !== 'all' && !entry.icons.includes(selectedMark)))
      if (!entry.row.hidden) visible++
    }
    scroll.hidden = visible === 0
    empty.hidden = visible > 0
  }
  section.append(scroll, empty)
  applyFilters()
  return section
}

export function summaryView(options: SummaryOptions): HTMLElement {
  const root = element('section', 'content summary-page')
  const heading = element('div', 'favorites-toolbar')
  heading.append(element('h1', '', 'Resumo'))
  const body = element('div', 'summary-body')
  root.append(heading, body)
  if (!options.load) {
    const rows = (options.demoVideos ?? []).filter((video) => video.state &&
      Object.entries(video.state).some(([key, value]) => key.startsWith('is_') && value))
      .map((video) => ({ video, addedAt: video.discovered_at }))
    body.append(metrics(options, options.launchCount), table(mergeStories(rows, options.stories), options))
  } else {
    body.append(notice('Carregando resumo…'))
    void options.load().then((data) => {
      body.replaceChildren(metrics(options, options.launchCount), table(mergeStories(data.rows, options.stories), options))
    }).catch((error: unknown) => body.replaceChildren(notice(
      error instanceof Error ? error.message : 'Resumo indisponível.', 'error')))
  }
  return root
}
