import type { Video } from './model.ts'

export interface TrackedStory {
  id: string
  owner_id: string
  seed_video_id: string | null
  name: string
  canonical_key: string
  aliases: string[]
  is_followed: boolean
  completed_at: string | null
  last_scanned_at: string | null
  created_at: string
}

export interface StoryCandidate {
  id: string
  story_id: string
  video_id: string
  status: 'pending' | 'confirmed' | 'rejected'
  score: number
  reason: string
  detected_at: string
  decided_at: string | null
  video: Video
}

export interface StoryGroup {
  story: TrackedStory
  seed: Video | null
  confirmed: StoryCandidate[]
  pending: StoryCandidate[]
}

export interface StoryDashboard {
  groups: StoryGroup[]
  completed: StoryGroup[]
  pendingCount: number
}
