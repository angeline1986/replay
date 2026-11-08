import { supabase } from '../shared/api.ts'
import { loadStoryDashboard } from '../shared/stories-api.ts'
import type { Channel } from '../shared/model.ts'

export async function storySnapshot(id: string, channels: Channel[]) {
  try { return { data: await loadStoryDashboard(supabase!, id, channels), error: '' } }
  catch { return { data: { groups: [], completed: [], pendingCount: 0 },
    error: 'Minhas histórias indisponível. Confira a migration e as permissões.' } }
}
