import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { sequenceView } from '../../src/features/stories/sequence-view.ts'
import { demoVideos } from '../../src/shared/demo.ts'
import type { StoryCandidate } from '../../src/shared/story-model.ts'

test('sequência abre em Lançamentos com cartões, ordem de partes e decisões', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    const events: string[] = []
    const seed = { ...demoVideos[0], title: '|31-38| Obra de exemplo' }
    const part39 = { ...demoVideos[0], id: 'part-39', youtube_video_id: 'aaaaaaaaaaa',
      title: '|39| Obra de exemplo', published_at: '2026-01-01T00:00:00Z' }
    const part40 = { ...demoVideos[0], id: 'part-40', youtube_video_id: 'bbbbbbbbbbb',
      title: '|40| Obra de exemplo', published_at: '2026-01-02T00:00:00Z' }
    const part41 = { ...demoVideos[0], id: 'part-41', youtube_video_id: 'ccccccccccc',
      title: '|41| Obra de exemplo', published_at: '2026-01-03T00:00:00Z' }
    const match = (id: string, video: typeof part39, status: 'confirmed' | 'pending'): StoryCandidate => ({
      id, story_id: 'story', video_id: video.id, status, score: 95, reason: 'Mesmo canal',
      detected_at: '2026-01-04T00:00:00Z', decided_at: null, video
    })
    const story = { id: 'story', owner_id: 'owner', seed_video_id: seed.id,
      name: seed.title, canonical_key: 'obra de exemplo', aliases: [], is_followed: true,
      completed_at: null, last_scanned_at: null, created_at: '2026-01-01T00:00:00Z' }
    const view = sequenceView({ id: story.id,
      data: { groups: [{ story, seed, confirmed: [match('m39', part39, 'confirmed')],
        pending: [match('m41', part41, 'pending'), match('m40', part40, 'pending')] }],
      completed: [], pendingCount: 2 },
      onBack: () => events.push('back'), onUnfollow: () => events.push('unfollow'), onResume: () => events.push('resume'),
      onToggle: (_video, key) => events.push(key),
      onDecide: (item, status) => events.push(`${item.id}:${status}`) })
    assert.equal(view.querySelector('h1')?.textContent, 'Lançamentos')
    assert.equal(view.querySelectorAll('.video-grid').length, 2)
    assert.equal(view.querySelectorAll('.video-card').length, 4)
    assert.equal(view.querySelector('.sequence-title'), null)
    assert.equal(view.querySelectorAll('.video-badge-row').length, 0)
    assert.equal(view.querySelector('.sequence-section h2')?.textContent, 'Possíveis continuações')
    assert.equal(view.querySelector('.sequence-decision .video-meta')?.textContent, 'Confiança alta')
    const preview = view.querySelector<HTMLAnchorElement>('.sequence-card .video-art')!
    assert.equal(preview.hostname, 'www.youtube.com')
    assert.equal(preview.querySelector('.new-badge')?.textContent, 'Novo')
    assert.deepEqual([...view.querySelectorAll('.sequence-section:last-child .video-card h2')]
      .map((node) => node.textContent), [part40.title, part41.title])
    assert.equal(view.querySelector('.follow-sequence'), null)
    view.querySelector<HTMLButtonElement>('.sequence-card .icon-star')!.click()
    view.querySelector<HTMLButtonElement>('.sequence-decision .primary')!.click()
    view.querySelector<HTMLButtonElement>('.sequence-decision .ghost')!.click()
    view.querySelector<HTMLButtonElement>('.sequence-toolbar-actions .ghost')!.click()
    assert.equal(view.querySelector('.sequence-unfollow'), null)
    view.querySelector<HTMLButtonElement>('.sequence-card .icon-runner')!.click()
    assert.deepEqual(events, ['is_favorite', 'm40:confirmed', 'm40:rejected', 'back', 'unfollow'])
    const withoutPending = sequenceView({ id: story.id,
      data: { groups: [{ story, seed, confirmed: [], pending: [] }], completed: [], pendingCount: 0 },
      onBack: () => {}, onUnfollow: () => {}, onResume: () => {}, onToggle: () => {}, onDecide: () => {} })
    assert.equal(withoutPending.querySelectorAll('.video-card').length, 1)
    assert.equal(withoutPending.querySelector('.sequence-section'), null)
    assert.doesNotMatch(withoutPending.textContent ?? '', /Nenhuma continuação pendente/)
    const completed = sequenceView({ id: story.id,
      data: { groups: [], completed: [{ story: { ...story, is_followed: false,
        completed_at: '2026-11-09T12:00:00Z' }, seed, confirmed: [], pending: [] }], pendingCount: 0 },
      onBack: () => {}, onUnfollow: () => events.push('unfollow-again'),
      onResume: () => events.push('resume'), onToggle: () => {}, onDecide: () => {} })
    const runner = completed.querySelector<HTMLButtonElement>('.sequence-card .icon-runner')!
    assert.equal(runner.getAttribute('aria-pressed'), 'false')
    runner.click()
    assert.equal(events.at(-1), 'resume')
  } finally { globalThis.document = original; dom.window.close() }
})
