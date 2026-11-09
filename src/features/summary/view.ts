import { element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Channel, type Video } from '../../shared/model.ts'
import type { StoryDashboard } from '../../shared/story-model.ts'
import type { SummaryData, SummaryRow } from './data.ts'

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

function marks(video: Video, stories: StoryDashboard): string[] {
  const labels: string[] = []
  if (video.state?.is_favorite) labels.push('Favorito')
  if (video.state?.is_watched) labels.push('Visto')
  if (video.state?.is_queued) labels.push('Fila de espera')
  if (video.state?.is_deprioritized) labels.push('Despriorizado')
  const includes = (group: StoryDashboard['groups'][number]) =>
    group.seed?.youtube_video_id === video.youtube_video_id ||
    group.confirmed.some((item) => item.video.youtube_video_id === video.youtube_video_id)
  if (stories.groups.some(includes)) labels.push('Acompanhando')
  if (stories.completed.some(includes)) labels.push('Concluído')
  return labels
}

function metrics(options: SummaryOptions, launchCount: number): HTMLElement {
  const grid = element('div', 'summary-metrics')
  const items: [string, number, string][] = [
    ['Vídeos favoritos', options.favorites.length, '#favorites'],
    ['Minhas histórias', options.stories.groups.length, '#stories'],
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
  section.append(element('h2', '', 'Vídeos marcados'))
  if (!rows.length) { section.append(notice('Nenhum vídeo marcado ainda.')); return section }
  const scroll = element('div', 'summary-table-scroll')
  const table = element('table', 'summary-table')
  const head = element('thead')
  const header = element('tr')
  for (const label of ['Canal', 'Vídeo', 'Data da adição', 'Marcações']) header.append(element('th', '', label))
  head.append(header)
  const body = element('tbody')
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
    for (const label of marks(video, options.stories)) markCell.append(element('span', 'summary-mark', label))
    row.append(markCell)
    body.append(row)
  }
  table.append(head, body)
  scroll.append(table)
  section.append(scroll)
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
