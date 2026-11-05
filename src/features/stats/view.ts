import { element } from '../../shared/dom.ts'
import type { Channel, Video } from '../../shared/model.ts'

export function statsView(channels: Channel[], videos: Video[], favoriteCount?: number): HTMLElement {
  const stats = element('section', 'stats')
  stats.setAttribute('aria-label', 'Resumo da coleção carregada')
  const items = [
    ['Canais ativos', channels.filter((channel) => channel.is_active).length],
    ['Vídeos carregados', videos.length],
    ['Seus favoritos', favoriteCount ?? videos.filter((video) => video.state?.is_favorite).length],
    ['Ainda não vistos', videos.filter((video) => !video.state?.is_watched).length]
  ] as const
  for (const [label, value] of items) {
    const stat = element('div', 'stat')
    stat.append(element('span', 'stat-label', label), element('strong', '', String(value)))
    stats.append(stat)
  }
  return stats
}
