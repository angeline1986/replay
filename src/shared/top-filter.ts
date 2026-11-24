import type { Channel, Video } from './model.ts'
import { selectPicker } from './select-picker.ts'

export type TopFilter = 'all' | 'top-first' | 'top-only'

export function topFilterPicker(value: TopFilter, onChange: (value: TopFilter) => void): HTMLDivElement {
  return selectPicker({
    choices: [{ value: 'all', label: 'Todos' }, { value: 'top-first', label: '+ Topzera' },
      { value: 'top-only', label: 'Só Topzera' }],
    value, label: 'Filtrar canais tops', className: 'channel-top-filter', onChange
  })
}

export function isTopChannel(channelId: string, channels: Channel[]): boolean {
  return channels.some((channel) => channel.is_top &&
    (channel.id === channelId || channel.youtube_channel_id === channelId))
}

export function isTopVideo(video: Video, channels: Channel[]): boolean {
  return isTopChannel(video.channel_id, channels)
}
