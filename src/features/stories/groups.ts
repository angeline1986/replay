import { element } from '../../shared/dom.ts'
import type { Channel } from '../../shared/model.ts'
import type { StoryGroup } from '../../shared/story-model.ts'

export function storyChannelId(group: StoryGroup): string {
  return (group.seed ?? group.confirmed[0]?.video)?.channel_id ?? ''
}

export function storyChannelGroups(
  items: StoryGroup[], channels: Channel[], renderCard: (group: StoryGroup) => HTMLElement
): HTMLElement {
  const byChannel = new Map<string, StoryGroup[]>()
  for (const item of items) {
    const id = storyChannelId(item)
    byChannel.set(id, [...(byChannel.get(id) ?? []), item])
  }
  const groups = element('div', 'favorite-channel-groups')
  for (const [id, stories] of byChannel) {
    const channel = channels.find((item) => item.id === id)
    const name = channel?.name ?? (stories[0].seed ?? stories[0].confirmed[0]?.video)?.channel?.name ?? 'Canal'
    const section = element('section', groups.childElementCount ? 'favorite-channel-group' : 'favorite-channel-group first-channel-group')
    const heading = element('div', 'favorite-channel-heading')
    const avatar = element('span', 'avatar favorite-channel-avatar', name.slice(0, 1).toUpperCase())
    if (channel?.avatar_url) {
      const image = element('img')
      image.src = channel.avatar_url
      image.alt = ''
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      avatar.replaceChildren(image)
    }
    heading.append(avatar, element('h3', '', name),
      element('span', 'result-count', `${stories.length} história${stories.length === 1 ? '' : 's'}`))
    const grid = element('div', 'video-grid follow-grid')
    for (const story of stories) grid.append(renderCard(story))
    section.append(heading, grid)
    groups.append(section)
  }
  return groups
}
