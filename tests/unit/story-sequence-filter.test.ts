import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { storiesView } from '../../src/features/stories/view.ts'
import { demoChannels, demoVideos } from '../../src/shared/demo.ts'
import type { StoryCandidate, StoryGroup } from '../../src/shared/story-model.ts'

function group(id: string, kind: 'none' | 'confirmed' | 'pending'): StoryGroup {
  const story = { id, owner_id: 'owner', seed_video_id: demoVideos[0].id,
    name: `Obra ${id}`, canonical_key: id, aliases: [], is_followed: true,
    completed_at: null, last_scanned_at: null, created_at: '2026-11-09T12:00:00Z' }
  const candidate: StoryCandidate = { id: `${id}-candidate`, story_id: id,
    video_id: demoVideos[1].id, status: kind === 'confirmed' ? 'confirmed' : 'pending',
    score: 90, reason: 'continuação', detected_at: '2026-11-09T13:00:00Z',
    decided_at: null, video: demoVideos[1] }
  return { story, seed: demoVideos[0],
    confirmed: kind === 'confirmed' ? [candidate] : [],
    pending: kind === 'pending' ? [candidate] : [] }
}

test('Sequência mostra somente histórias com continuação e mantém o filtro fora de Concluídos', () => {
  const previous = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const groups = [group('sem', 'none'), group('confirmada', 'confirmed'), group('possivel', 'pending')]
    let selected = ''
    const options = { data: { groups, completed: [groups[1]], pendingCount: 1 },
      channels: demoChannels, selectedChannelId: '', onChannelSelect: () => {},
      query: '', onQuery: () => {}, sort: 'recent' as const,
      onSort: (value: string) => { selected = value },
      onLookupYouTube: async () => { throw Error('unused') }, onSaveYouTube: () => {},
      onToggleVideo: () => {}, onOpenSequence: () => {}, onComplete: () => {} }
    const active = storiesView(options)
    active.querySelector<HTMLButtonElement>('.favorite-sort [data-channel-id="sequence"]')!.click()
    assert.equal(selected, 'sequence')
    const filtered = storiesView({ ...options, sort: 'sequence' })
    assert.equal(filtered.querySelector('.favorite-total')?.textContent, '2')
    assert.deepEqual(new Set([...filtered.querySelectorAll<HTMLElement>('.follow-card')]
      .map((card) => card.dataset.storyId)), new Set(['confirmada', 'possivel']))
    const completed = storiesView({ ...options, mode: 'completed' })
    assert.equal(completed.querySelector('.favorite-sort [data-channel-id="sequence"]'), null)
  } finally { globalThis.document = previous; dom.window.close() }
})
