import type { Channel, ChannelRequest, Video, VideoFilter } from '../shared/model.ts'
import { demoChannels, demoVideos } from '../shared/demo.ts'
import { routeFromHash } from './route.ts'
import type { StoryDashboard } from '../shared/story-model.ts'

export interface AppState {
  channels: Channel[]
  requests: ChannelRequest[]
  videos: Video[]
  highlights: Video[]
  favoriteVideos: Video[]
  deprioritizedVideos: Video[]
  queuedVideos: Video[]
  stories: StoryDashboard
  storiesError: string
  hasMore: boolean
  filter: VideoFilter
  page: 'favorites' | 'videos' | 'channels' | 'stories' | 'completed' | 'deprioritized' | 'queue'
  sort: 'recent' | 'az'
  channelTopFilter: 'all' | 'top-first' | 'top-only'
  storyChannelId: string
  completedChannelId: string
  completedQuery: string
  completedSort: 'recent' | 'az'
  busy: boolean
  error: string
  importMessage: string
  demo: boolean
}

export const state: AppState = {
  channels: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoChannels) : [],
  requests: [],
  videos: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoVideos) : [],
  highlights: import.meta.env.VITE_DEMO === 'true' ? structuredClone(demoVideos) : [],
  favoriteVideos: [],
  deprioritizedVideos: [],
  queuedVideos: [],
  stories: { groups: [], completed: [], pendingCount: 0 },
  storiesError: '',
  hasMore: false,
  filter: { query: '', status: 'all', channelId: routeFromHash(location.hash).channelId },
  page: routeFromHash(location.hash).page,
  sort: 'recent',
  channelTopFilter: 'all',
  storyChannelId: '',
  completedChannelId: '',
  completedQuery: '',
  completedSort: 'recent',
  busy: false,
  error: '',
  importMessage: '',
  demo: import.meta.env.VITE_DEMO === 'true'
}
