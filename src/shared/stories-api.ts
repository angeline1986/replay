import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel, Video, VideoState } from './model.ts'
import { distinctEnough, normalizeStoryText } from './story-match.ts'
import type { StoryCandidate, StoryDashboard, TrackedStory } from './story-model.ts'

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export function storyInput(name: string, aliases: string[]): {
  name: string; canonical_key: string; aliases: string[]
} {
  const cleanName = name.trim().replace(/\s+/g, ' ')
  const cleanAliases = [...new Set(aliases.map((item) => item.trim()).filter(Boolean))]
  if (cleanName.length > 200 || !distinctEnough(cleanName) ||
      cleanAliases.length > 10 || cleanAliases.some((item) => item.length > 200)) {
    throw new Error('Informe um nome de obra distintivo e até 10 aliases de 200 caracteres.')
  }
  const key = normalizeStoryText(cleanName)
  if (key.length < 3 || key.length > 200) throw new Error('Nome de obra inválido.')
  return { name: cleanName, canonical_key: key, aliases: cleanAliases }
}

export async function attachStoryVideo(
  db: SupabaseClient, storyId: string, videoId: string
): Promise<'confirmed' | 'already_confirmed'> {
  const result = await db.rpc('attach_story_video', { p_story_id: storyId, p_video_id: videoId })
  check(result.error)
  if (result.data !== 'confirmed' && result.data !== 'already_confirmed') {
    throw new Error('Associação manual não confirmada.')
  }
  return result.data
}

export async function followStory(
  db: SupabaseClient, ownerId: string, videoId: string, name: string, aliases: string[]
): Promise<{ id: string; existing: boolean }> {
  const fields = storyInput(name, aliases)
  const current = await db.from('tracked_stories').select('id,is_followed')
    .eq('owner_id', ownerId).eq('canonical_key', fields.canonical_key).maybeSingle()
  check(current.error)
  if (current.data) {
    if (!current.data.is_followed) {
      const reopened = await db.from('tracked_stories').update({ is_followed: true, completed_at: null })
        .eq('id', current.data.id).eq('owner_id', ownerId).select('id').single()
      check(reopened.error)
    }
    return { id: current.data.id as string, existing: true }
  }
  const result = await db.from('tracked_stories').insert({
    owner_id: ownerId, seed_video_id: videoId, ...fields
  }).select('id').single()
  check(result.error)
  if (!result.data) throw new Error('História não criada.')
  return { id: result.data.id as string, existing: false }
}

export async function renameStory(
  db: SupabaseClient, ownerId: string, storyId: string, name: string, aliases: string[]
): Promise<void> {
  const result = await db.from('tracked_stories').update(storyInput(name, aliases))
    .eq('id', storyId).eq('owner_id', ownerId).select('id')
  check(result.error)
  if (result.data?.length !== 1) throw new Error('História não encontrada.')
}

export async function unfollowStory(db: SupabaseClient, ownerId: string, storyId: string): Promise<void> {
  const result = await db.from('tracked_stories').update({ is_followed: false })
    .eq('id', storyId).eq('owner_id', ownerId).select('id')
  check(result.error)
  if (result.data?.length !== 1) throw new Error('História não encontrada.')
}

export async function setStoryCompleted(
  db: SupabaseClient, ownerId: string, storyId: string, completed: boolean
): Promise<void> {
  const result = await db.from('tracked_stories').update({
    is_followed: !completed, completed_at: completed ? new Date().toISOString() : null
  }).eq('id', storyId).eq('owner_id', ownerId).select('id')
  check(result.error)
  if (result.data?.length !== 1) throw new Error('História não encontrada.')
}

export async function decideCandidate(
  db: SupabaseClient, storyId: string, matchId: string, status: 'confirmed' | 'rejected'
): Promise<void> {
  const result = await db.from('story_matches')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', matchId).eq('story_id', storyId).eq('status', 'pending').select('id')
  check(result.error)
  if (result.data?.length !== 1) throw new Error('Sugestão já decidida ou não autorizada.')
}

interface MatchRow extends Omit<StoryCandidate, 'video'> {}

async function loadMatches(db: SupabaseClient, storyIds: string[]): Promise<MatchRow[]> {
  const rows: MatchRow[] = []
  for (let offset = 0; offset < storyIds.length; offset += 50) {
    const batch = storyIds.slice(offset, offset + 50)
    for (let page = 0; ; page += 500) {
      const result = await db.from('story_matches')
        .select('id,story_id,video_id,status,score,reason,detected_at,decided_at')
        .in('story_id', batch).in('status', ['pending', 'confirmed'])
        .order('detected_at', { ascending: false }).order('id').range(page, page + 499)
      check(result.error)
      const next = (result.data ?? []) as MatchRow[]
      rows.push(...next)
      if (next.length < 500) break
    }
  }
  return rows
}

async function loadStoryVideos(db: SupabaseClient, ownerId: string, ids: string[], channels: Channel[]): Promise<Map<string, Video>> {
  const byChannel = new Map(channels.map((item) => [item.id, item]))
  const videos = new Map<string, Video>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100)
    const [result, states] = await Promise.all([
      db.from('videos').select('id,channel_id,youtube_video_id,title,url,thumbnail_url,published_at,discovered_at').in('id', batch),
      db.from('user_video_state').select('video_id,is_favorite,is_watched,is_deprioritized,is_queued')
        .eq('user_id', ownerId).in('video_id', batch)
    ])
    check(result.error); check(states.error)
    const byVideo = new Map(((states.data ?? []) as VideoState[]).map((state) => [state.video_id, state]))
    for (const video of (result.data ?? []) as Video[]) {
      videos.set(video.id, { ...video, channel: byChannel.get(video.channel_id), state: byVideo.get(video.id) })
    }
  }
  return videos
}

export async function loadStoryDashboard(
  db: SupabaseClient, ownerId: string, channels: Channel[]
): Promise<StoryDashboard> {
  const stories: TrackedStory[] = []
  for (let page = 0; ; page += 500) {
    const result = await db.from('tracked_stories')
      .select('id,owner_id,seed_video_id,name,canonical_key,aliases,is_followed,completed_at,last_scanned_at,created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false }).order('id').range(page, page + 499)
    check(result.error)
    const batch = (result.data ?? []) as TrackedStory[]
    stories.push(...batch)
    if (batch.length < 500) break
  }
  const visibleStories = stories.filter((item) => item.is_followed || item.completed_at)
  if (!visibleStories.length) return { groups: [], completed: [], pendingCount: 0 }
  const matches = await loadMatches(db, visibleStories.map((item) => item.id))
  const ids = [...new Set([...visibleStories.map((item) => item.seed_video_id).filter((id): id is string => !!id),
    ...matches.map((item) => item.video_id)])]
  const videos = await loadStoryVideos(db, ownerId, ids, channels)
  const groups = visibleStories.map((story) => {
    const related = matches.filter((item) => item.story_id === story.id)
      .map((item) => ({ ...item, video: videos.get(item.video_id) }))
      .filter((item): item is MatchRow & { video: Video } => !!item.video)
    return { story, seed: story.seed_video_id ? videos.get(story.seed_video_id) ?? null : null,
      confirmed: related.filter((item) => item.status === 'confirmed')
        .sort((a, b) => Date.parse(a.video.published_at) - Date.parse(b.video.published_at)),
      pending: related.filter((item) => item.status === 'pending') }
  })
  const active = groups.filter((group) => group.story.is_followed)
  return { groups: active, completed: groups.filter((group) => Boolean(group.story.completed_at)),
    pendingCount: active.reduce((total, group) => total + group.pending.length, 0) }
}
