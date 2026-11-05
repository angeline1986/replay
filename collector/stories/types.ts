import type { StoryPosition, TrackedPattern } from '../../src/shared/story-match.ts'

export interface ScanStory {
  id: string
  ownerId: string
  name: string
  aliases: string[]
  seedVideoId: string | null
  lastScannedAt: string | null
  updatedAt: string
}

export interface StoredVideo {
  id: string
  channel_id: string
  title: string
  published_at: string
  discovered_at: string
}

export interface StoryContext {
  pattern: TrackedPattern
  knownVideoIds: Set<string>
}

export interface CandidateRow {
  story_id: string
  video_id: string
  status: 'pending'
  score: number
  reason: string
  position_kind: StoryPosition['kind'] | null
  position_first: number | null
  position_last: number | null
  season: number | null
}

export interface StoryStore {
  activeStories(): Promise<ScanStory[]>
  context(story: ScanStory): Promise<StoryContext | null>
  videos(ownerId: string, since: string | null, until: string): Promise<StoredVideo[]>
  addCandidates(rows: CandidateRow[]): Promise<number>
  markScanned(story: ScanStory, until: string): Promise<void>
}
