import { element } from '../../shared/dom.ts'
import type { Channel, Video } from '../../shared/model.ts'

export function favoriteVideoGroups(
  videos: Video[], channels: Channel[], sort: 'recent' | 'az', renderCard: (video: Video) => HTMLElement
): HTMLElement {
  const groups = new Map<string, Video[]>()
  for (const video of videos) groups.set(video.channel_id, [...(groups.get(video.channel_id) ?? []), video])
  const ordered = [...groups.entries()].sort(([leftId, left], [rightId, right]) => sort === 'az'
    ? left[0].title.localeCompare(right[0].title, 'pt-BR')
    : Date.parse(right[0].published_at) - Date.parse(left[0].published_at))
  const result = element('div', 'favorite-channel-groups')
  ordered.forEach(([channelId, items], index) => {
    const channel = channels.find((item) => item.id === channelId)
    const group = element('section', index ? 'favorite-channel-group' : 'favorite-channel-group first-channel-group')
    const heading = element('div', 'favorite-channel-heading')
    const avatar = element('span', 'avatar favorite-channel-avatar',
      (channel?.name ?? items[0].channel?.name ?? '?').slice(0, 1).toUpperCase())
    if (channel?.avatar_url) {
      const image = element('img')
      image.src = channel.avatar_url
      image.alt = ''
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      avatar.replaceChildren(image)
    }
    heading.append(avatar, element('h3', '', channelName(items[0], channels)))
    heading.append(element('span', 'result-count', `${items.length} vídeo${items.length === 1 ? '' : 's'}`))
    group.append(heading)
    const grid = element('div', 'video-grid favorite-video-list')
    for (const video of items) grid.append(renderCard(video))
    group.append(grid)
    result.append(group)
  })
  return result
}

function channelName(video: Video, channels: Channel[]): string {
  return channels.find((item) => item.id === video.channel_id)?.name ?? video.channel?.name ?? 'Canal'
}
