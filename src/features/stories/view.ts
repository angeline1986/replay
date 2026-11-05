import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Video } from '../../shared/model.ts'
import { parseStoryPosition } from '../../shared/story-match.ts'
import type { StoryCandidate, StoryDashboard, TrackedStory } from '../../shared/story-model.ts'
import './view.css'

interface StoryViewOptions {
  data: StoryDashboard
  onDecide: (candidate: StoryCandidate, status: 'confirmed' | 'rejected') => void
  onRename: (story: TrackedStory) => void
  onUnfollow: (story: TrackedStory) => void
}

function videoLink(video: Video, subtitle: string): HTMLElement {
  const row = element('div', 'follow-video')
  const a = element('a', '', video.title)
  a.href = validVideoUrl(video.youtube_video_id)
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  row.append(a, element('p', 'video-meta', subtitle))
  return row
}

function sequence(group: StoryDashboard['groups'][number], options: StoryViewOptions): HTMLElement {
  const body = element('div', 'follow-sequence')
  const controls = element('div', 'follow-controls')
  controls.append(button('Deixar de acompanhar', () => options.onUnfollow(group.story)))
  body.append(controls, element('h3', '', 'Vídeos confirmados'))
  if (group.seed) body.append(videoLink(group.seed, 'Vídeo inicial'))
  for (const item of group.confirmed) {
    body.append(videoLink(item.video, 'Continuação confirmada'))
  }
  if (!group.seed && !group.confirmed.length) {
    body.append(element('p', 'muted small', 'Nenhum vídeo confirmado disponível.'))
  }
  body.append(element('h3', '', `Possíveis continuações (${group.pending.length})`))
  if (!group.pending.length) {
    body.append(element('p', 'muted small', group.story.last_scanned_at
      ? 'Nenhuma sugestão pendente.'
      : 'A primeira verificação ocorrerá após a próxima coleta.'))
  }
  for (const candidate of group.pending) {
    const item = element('div', 'follow-candidate')
    item.append(videoLink(candidate.video,
      `Confiança ${candidate.score >= 85 ? 'alta' : 'média'} · ${candidate.reason}`))
    const actions = element('div', 'follow-candidate-actions')
    actions.append(
      button('Confirmar continuação', () => options.onDecide(candidate, 'confirmed')),
      button('Rejeitar sugestão', () => options.onDecide(candidate, 'rejected'))
    )
    item.append(actions)
    body.append(item)
  }
  return body
}

function storyCard(group: StoryDashboard['groups'][number], options: StoryViewOptions): HTMLElement {
  const card = element('article', 'follow-card')
  const hero = element('div', 'follow-hero')
  const cover = group.seed ?? group.confirmed[0]?.video ?? null
  if (cover?.thumbnail_url) {
    const img = element('img')
    img.src = cover.thumbnail_url
    img.alt = ''
    img.loading = 'lazy'
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('error', () => img.remove())
    hero.append(img)
  }
  hero.append(element('span', 'follow-play', '▶'))
  const count = Number(Boolean(group.seed)) + group.confirmed.length
  hero.append(element('span', 'follow-count',
    `${count} vídeo${count === 1 ? '' : 's'} confirmado${count === 1 ? '' : 's'}`))
  if (group.pending.length) {
    hero.append(element('span', 'follow-alert',
      `+${group.pending.length} continuação${group.pending.length === 1 ? '' : 'ões'} encontrada${group.pending.length === 1 ? '' : 's'}`))
  }
  card.append(hero)
  const info = element('div', 'follow-info')
  info.append(element('h2', '', group.story.name))
  info.append(element('p', 'video-meta',
    `${cover?.channel?.name ?? 'Canal'} · ${cover ? new Date(cover.published_at).toLocaleDateString('pt-BR') : 'Sem vídeo'}`))
  const tags = element('div', 'follow-tags')
  tags.append(element('span', 'follow-tag', '✓ Acompanhando'))
  const position = cover ? parseStoryPosition(cover.title) : null
  if (position) {
    const label = position.kind === 'part' ? 'Parte' :
      position.kind === 'chapter' ? 'Capítulo' : 'Episódio'
    tags.append(element('span', 'follow-tag secondary', `${label} ${position.first}${position.last !== position.first ? `–${position.last}` : ''}`))
  }
  info.append(tags)
  card.append(info)
  const sequencePanel = sequence(group, options)
  sequencePanel.hidden = true
  const footer = element('div', 'follow-footer')
  const expand = button(`Ver sequência (${count})`, () => {
    sequencePanel.hidden = !sequencePanel.hidden
    expand.setAttribute('aria-expanded', String(!sequencePanel.hidden))
  }, 'follow-expand')
  expand.setAttribute('aria-expanded', 'false')
  footer.append(expand, button('Renomear', () => options.onRename(group.story), 'follow-rename'))
  if (cover) {
    const link = element('a', 'follow-open', 'Abrir ↗')
    link.href = validVideoUrl(cover.youtube_video_id)
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    footer.append(link)
  }
  card.append(footer, sequencePanel)
  return card
}

export function storiesView(options: StoryViewOptions): HTMLElement {
  const root = element('section', 'content')
  const intro = element('div', 'page-head')
  const heading = element('div')
  heading.append(element('p', 'eyebrow', 'SUAS LEITURAS'),
    element('h1', '', 'Minhas histórias'),
    element('p', 'subtitle', 'Acompanhe suas histórias e confirme novas continuações.'))
  intro.append(heading)
  root.append(intro)
  if (!options.data.groups.length) {
    root.append(notice('Você ainda não acompanha histórias. Use “Acompanhar esta história” em um vídeo.'))
    return root
  }
  const header = element('div', 'section-title follow-heading')
  header.append(element('h2', '', 'Histórias em acompanhamento'),
    element('span', 'result-count', `${options.data.groups.length} histórias ativas`))
  root.append(header)
  const grid = element('div', 'video-grid follow-grid')
  for (const group of options.data.groups) grid.append(storyCard(group, options))
  root.append(grid)
  return root
}
