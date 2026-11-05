import type { Channel, ChannelRequest, Video, VideoFilter } from '../shared/model.ts'
import { demoChannels, demoVideos } from '../shared/demo.ts'
import { routeFromHash } from './route.ts'

export interface AppState {
  channels: Channel[]
  requests: ChannelRequest[]
  videos: Video[]
  highlights: Video[]
  favoriteVideos: Video[]
  hasMore: boolean
  filter: VideoFilter
  page: 'favorites' | 'videos' | 'channels'
  sort: 'recent' | 'az'
  busy: boolean
  error: string
  demo: boolean
  userEmail: string
}

export const state: AppState = {
  channels: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoChannels) : [],
  requests: [],
  videos: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoVideos) : [],
  highlights: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoVideos) : [],
  favoriteVideos: [],
  hasMore: false,
  filter: { query: '', status: 'all', channelId: routeFromHash(location.hash).channelId },
  page: routeFromHash(location.hash).page,
  sort: 'recent',
  busy: false,
  error: '',
  demo: import.meta.env.VITE_DEMO === 'true',
  userEmail: ''
}
