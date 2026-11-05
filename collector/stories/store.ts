import { parseStoryPosition } from '../../src/shared/story-match.ts'
import { db } from '../persistence/store.ts'
import type { CandidateRow, ScanStory, StoredVideo, StoryContext, StoryStore } from './types.ts'

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

interface MatchRow { video_id: string; status: 'pending' | 'confirmed' | 'rejected' }

async function activeStories(): Promise<ScanStory[]> {
  const stories: ScanStory[] = []
  for (let page = 0; ; page += 500) {
    const result = await db.from('tracked_stories')
      .select('id,owner_id,name,aliases,seed_video_id,last_scanned_at,updated_at')
      .eq('is_followed', true).order('id').range(page, page + 499)
    check(result.error)
    const batch = result.data ?? []
    stories.push(...batch.map((item) => ({ id: item.id, ownerId: item.owner_id,
      name: item.name, aliases: item.aliases, seedVideoId: item.seed_video_id,
      lastScannedAt: item.last_scanned_at, updatedAt: item.updated_at })))
    if (batch.length < 500) return stories
  }
}

async function matches(storyId: string): Promise<MatchRow[]> {
  const rows: MatchRow[] = []
  for (let page = 0; ; page += 500) {
    const result = await db.from('story_matches').select('video_id,status')
      .eq('story_id', storyId).order('id').range(page, page + 499)
    check(result.error)
    rows.push(...(result.data ?? []) as MatchRow[])
    if ((result.data ?? []).length < 500) return rows
  }
}

async function fetchVideos(ids: string[]): Promise<StoredVideo[]> {
  const rows: StoredVideo[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await db.from('videos')
      .select('id,channel_id,title,published_at,discovered_at').in('id', ids.slice(offset, offset + 100))
    check(result.error)
    rows.push(...(result.data ?? []) as StoredVideo[])
  }
  return rows
}

async function context(story: ScanStory): Promise<StoryContext | null> {
  const rows = await matches(story.id)
  const knownVideoIds = new Set(rows.map((item) => item.video_id))
  const confirmedIds = rows.filter((item) => item.status === 'confirmed').map((item) => item.video_id)
  const ids = [...new Set([...confirmedIds, story.seedVideoId].filter((id): id is string => !!id))]
  const confirmed = await fetchVideos(ids)
  if (!confirmed.length) return null
  confirmed.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
  const numbered = confirmed.find((video) => parseStoryPosition(video.title))
  return { knownVideoIds, pattern: {
    title: story.name, aliases: story.aliases,
    channelIds: [...new Set(confirmed.map((video) => video.channel_id))],
    lastPosition: numbered ? parseStoryPosition(numbered.title) : null,
    latestPublishedAt: confirmed[0].published_at
  } }
}

async function ownerChannels(ownerId: string): Promise<string[]> {
  const ids: string[] = []
  for (let page = 0; ; page += 500) {
    const result = await db.from('channels').select('id').eq('owner_id', ownerId)
      .order('id').range(page, page + 499)
    check(result.error)
    ids.push(...(result.data ?? []).map((item) => item.id))
    if ((result.data ?? []).length < 500) return ids
  }
}

async function videos(ownerId: string, since: string | null, until: string): Promise<StoredVideo[]> {
  const channelIds = await ownerChannels(ownerId)
  const rows: StoredVideo[] = []
  for (let offset = 0; offset < channelIds.length; offset += 50) {
    const batch = channelIds.slice(offset, offset + 50)
    for (let page = 0; ; page += 500) {
      let query = db.from('videos').select('id,channel_id,title,published_at,discovered_at')
        .in('channel_id', batch).lte('discovered_at', until)
        .order('discovered_at').order('id').range(page, page + 499)
      if (since) query = query.gte('discovered_at', since)
      const result = await query
      check(result.error)
      const next = (result.data ?? []) as StoredVideo[]
      rows.push(...next)
      if (rows.length > 20000) throw new Error('Varredura excedeu limite de 20.000 vídeos.')
      if (next.length < 500) break
    }
  }
  return rows
}

async function addCandidates(rows: CandidateRow[]): Promise<number> {
  let inserted = 0
  for (let offset = 0; offset < rows.length; offset += 100) {
    const result = await db.from('story_matches').upsert(rows.slice(offset, offset + 100), {
      onConflict: 'story_id,video_id', ignoreDuplicates: true
    }).select('id')
    check(result.error)
    inserted += result.data?.length ?? 0
  }
  return inserted
}

async function markScanned(story: ScanStory, until: string): Promise<void> {
  const result = await db.from('tracked_stories').update({ last_scanned_at: until })
    .eq('id', story.id).eq('updated_at', story.updatedAt).eq('is_followed', true).select('id')
  check(result.error)
  if (result.data?.length !== 1) throw new Error('História alterada durante a varredura; cursor preservado.')
}

export const storyStore: StoryStore = {
  activeStories, context, videos, addCandidates, markScanned
}
