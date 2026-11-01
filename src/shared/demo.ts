import type { Channel, Video } from './model.ts'

const owner = 'demo'
export const demoChannels: Channel[] = [
  {
    id: 'demo-1', owner_id: owner, youtube_channel_id: 'UC0000000000000000000000',
    handle: '@atelier', name: 'Ateliê Criativo', avatar_url: null, is_active: true,
    last_checked_at: '2026-10-31T10:00:00Z', last_success_at: '2026-10-31T10:00:00Z'
  },
  {
    id: 'demo-2', owner_id: owner, youtube_channel_id: 'UC1111111111111111111111',
    handle: '@ciencia', name: 'Ciência em Casa', avatar_url: null, is_active: true,
    last_checked_at: '2026-10-31T09:45:00Z', last_success_at: '2026-10-31T09:45:00Z'
  }
]

export const demoVideos: Video[] = [
  {
    id: 'demo-v1', channel_id: 'demo-1', youtube_video_id: 'aaaaaaaaaaa',
    title: 'Um novo projeto para o fim de semana',
    url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    thumbnail_url: '', published_at: '2026-10-31T08:00:00Z',
    discovered_at: '2026-10-31T08:15:00Z', channel: { id: 'demo-1', name: 'Ateliê Criativo' }
  },
  {
    id: 'demo-v2', channel_id: 'demo-2', youtube_video_id: 'bbbbbbbbbbb',
    title: 'Experimentos que cabem na mesa',
    url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb',
    thumbnail_url: '', published_at: '2026-10-30T18:00:00Z',
    discovered_at: '2026-10-30T18:15:00Z', channel: { id: 'demo-2', name: 'Ciência em Casa' }
  }
]
