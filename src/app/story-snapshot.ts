import { supabase } from '../shared/api.ts'
import { loadStoryDashboard } from '../shared/stories-api.ts'
import type { Channel } from '../shared/model.ts'
import type { StoryDashboard } from '../shared/story-model.ts'
import { scanStoryNow } from '../shared/story-discovery.ts'

const scanned = new Set<string>()
const running = new Set<string>()

export function rememberStoryScan(id: string): void { scanned.add(id) }

export async function scanExistingStories(
  data: StoryDashboard, onFound: () => Promise<void>, onError: (message: string) => void
): Promise<void> {
  const pending = data.groups.map((group) => group.story.id)
    .filter((id) => !scanned.has(id) && !running.has(id))
  let found = 0
  let failed = false
  for (let offset = 0; offset < pending.length; offset += 3) {
    await Promise.all(pending.slice(offset, offset + 3).map(async (id) => {
      running.add(id)
      try { found += await scanStoryNow(supabase!, id); scanned.add(id) }
      catch { failed = true }
      finally { running.delete(id) }
    }))
  }
  if (found) await onFound()
  if (failed) onError('Não foi possível procurar capítulos de algumas histórias. Tente novamente mais tarde.')
}

export async function storySnapshot(id: string, channels: Channel[]) {
  try { return { data: await loadStoryDashboard(supabase!, id, channels), error: '' } }
  catch { return { data: { groups: [], completed: [], pendingCount: 0 },
    error: 'Minhas histórias indisponível. Confira a migration e as permissões.' } }
}
