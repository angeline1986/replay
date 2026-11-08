import { button, element, notice } from '../../shared/dom.ts'
import { iconButton, iconGlyph } from '../videos/icons.ts'
import { validVideoUrl, type Channel, type Video } from '../../shared/model.ts'
import { parseStoryPosition } from '../../shared/story-match.ts'
import type { StoryCandidate, StoryDashboard, TrackedStory } from '../../shared/story-model.ts'

interface StoryViewOptions {
  data: StoryDashboard
  channels?: Channel[]
  onToggleVideo: (video: Video, key: 'is_favorite' | 'is_watched') => void
  onDecide: (candidate: StoryCandidate, status: 'confirmed' | 'rejected') => void
  onRename: (story: TrackedStory) => void
  onUnfollow: (story: TrackedStory) => void
}

function videoActions(video: Video, options: StoryViewOptions): HTMLElement {
  const actions = element('div', 'card-actions follow-video-actions')
  const favorite = Boolean(video.state?.is_favorite)
  const watched = Boolean(video.state?.is_watched)
  actions.append(iconButton(favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos', 'star',
    () => options.onToggleVideo(video, 'is_favorite'), favorite),
    iconButton(watched ? 'Marcar como não visto' : 'Marcar como visto', watched ? 'eye' : 'eye-slash',
      () => options.onToggleVideo(video, 'is_watched'), watched))
  return actions
}

function videoLink(video: Video, subtitle: string, options: StoryViewOptions): HTMLElement {
  const row = element('div', 'follow-video')
  const detail = element('div', 'follow-video-detail')
  const a = element('a', '', video.title)
  a.href = validVideoUrl(video.youtube_video_id)
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  detail.append(a, element('p', 'video-meta', subtitle))
  row.append(detail, videoActions(video, options))
  return row
}

function sequence(group: StoryDashboard['groups'][number], options: StoryViewOptions): HTMLElement {
  const body = element('div', 'follow-sequence')
  const controls = element('div', 'follow-controls')
  controls.append(button('Deixar de acompanhar', () => options.onUnfollow(group.story)))
  body.append(controls, element('h3', '', 'Vídeos confirmados'))
  if (group.seed) body.append(videoLink(group.seed, 'Vídeo inicial', options))
  for (const item of group.confirmed) {
    body.append(videoLink(item.video, 'Continuação confirmada', options))
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
      `Confiança ${candidate.score >= 85 ? 'alta' : 'média'} · ${candidate.reason}`, options))
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
  const following = element('span', 'follow-tag follow-tag-icon')
  following.append(iconGlyph('runner'))
  tags.append(following)
  if (cover) tags.append(videoActions(cover, options))
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
  const heading = element('div', 'favorites-toolbar')
  const title = element('div', 'favorite-page-title')
  title.append(element('h1', '', 'Minhas histórias'),
    element('span', 'favorite-total', String(options.data.groups.length)))
  heading.append(title)
  root.append(heading)
  if (!options.data.groups.length) {
    root.append(notice('Você ainda não acompanha histórias. Use “Acompanhar esta história” em um vídeo.'))
    return root
  }
  const byChannel = new Map<string, StoryDashboard['groups']>()
  for (const group of options.data.groups) {
    const id = (group.seed ?? group.confirmed[0]?.video)?.channel_id ?? ''
    byChannel.set(id, [...(byChannel.get(id) ?? []), group])
  }
  const groups = element('div', 'favorite-channel-groups')
  for (const [id, items] of byChannel) {
    const channel = options.channels?.find((item) => item.id === id)
    const name = channel?.name ?? (items[0].seed ?? items[0].confirmed[0]?.video)?.channel?.name ?? 'Canal'
    const section = element('section', groups.childElementCount ? 'favorite-channel-group' : 'favorite-channel-group first-channel-group')
    const heading = element('div', 'favorite-channel-heading')
    const avatar = element('span', 'avatar favorite-channel-avatar', name.slice(0, 1).toUpperCase())
    if (channel?.avatar_url) {
      const image = element('img')
      image.src = channel.avatar_url
      image.alt = ''
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      avatar.replaceChildren(image)
    }
    heading.append(avatar, element('h3', '', name),
      element('span', 'result-count', `${items.length} história${items.length === 1 ? '' : 's'}`))
    const grid = element('div', 'video-grid follow-grid')
    for (const item of items) grid.append(storyCard(item, options))
    section.append(heading, grid)
    groups.append(section)
  }
  root.append(groups)
  return root
}
