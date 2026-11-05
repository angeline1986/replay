import { proposeStoryMatch } from '../../src/shared/story-match.ts'
import { safeError } from '../jobs/safe-error.ts'
import type { CandidateRow, StoryStore } from './types.ts'

export interface DetectionSummary {
  stories: number
  candidates: number
  failures: number
}

export async function detectStoryCandidates(
  store: StoryStore, now = new Date().toISOString()
): Promise<DetectionSummary> {
  const stories = await store.activeStories()
  const result = { stories: 0, candidates: 0, failures: 0 }
  for (const story of stories) {
    try {
      const context = await store.context(story)
      if (!context) continue
      const since = story.lastScannedAt
        ? new Date(Date.parse(story.lastScannedAt) - 60000).toISOString() : null
      const videos = await store.videos(story.ownerId, since, now)
      const candidates: CandidateRow[] = []
      for (const video of videos) {
        if (video.id === story.seedVideoId || context.knownVideoIds.has(video.id)) continue
        const match = proposeStoryMatch(context.pattern, {
          title: video.title, channelId: video.channel_id, publishedAt: video.published_at
        })
        if (!match) continue
        candidates.push({
          story_id: story.id, video_id: video.id, status: 'pending',
          score: match.score, reason: match.reason,
          position_kind: match.position?.kind ?? null,
          position_first: match.position?.first ?? null,
          position_last: match.position?.last ?? null,
          season: match.position?.season ?? null
        })
      }
      result.candidates += await store.addCandidates(candidates)
      await store.markScanned(story, now)
      result.stories++
    } catch (error) {
      result.failures++
      console.error(`História ${story.id}: ${safeError(error)}`)
    }
  }
  return result
}
