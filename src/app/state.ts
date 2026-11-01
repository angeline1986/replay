import type { Channel, ChannelRequest, Video, VideoFilter } from '../shared/model.ts'
import { demoChannels, demoVideos } from '../shared/demo.ts'

export interface AppState {
  channels: Channel[]
  requests: ChannelRequest[]
  videos: Video[]
  hasMore: boolean
  filter: VideoFilter
  page: 'videos' | 'channels'
  busy: boolean
  error: string
  demo: boolean
  userEmail: string
}

export const state: AppState = {
  channels: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoChannels) : [],
  requests: [],
  videos: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoVideos) : [],
  hasMore: false,
  filter: { query: '', status: 'all', channelId: location.hash.match(/^#videos\/([a-f0-9-]{36})$/)?.[1] ?? '' },
  page: location.hash.startsWith('#channels') ? 'channels' : 'videos',
  busy: false,
  error: '',
  demo: import.meta.env.VITE_DEMO === 'true',
  userEmail: ''
}
