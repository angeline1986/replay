import { button, element, notice } from '../../shared/dom.ts'
import type { Channel, ChannelRequest, Video } from '../../shared/model.ts'
import { channelPicker } from '../../shared/channel-picker.ts'

const trophyUrl = new URL('../../assets/icons/trophy-solid-full.svg', import.meta.url).href
const youtubeUrl = new URL('../../assets/icons/youtube-brands-solid-full.svg', import.meta.url).href

interface ChannelViewOptions {
  channels: Channel[]
  topFilter?: 'all' | 'top-first' | 'top-only'
  onTopFilter?: (value: 'all' | 'top-first' | 'top-only') => void
  requests: ChannelRequest[]
  videos: Video[]
  busy?: boolean
  onAdd: (input: string) => void
  onToggle: (channel: Channel) => void
  onTop: (channel: Channel) => void
  onRemove: (channel: Channel) => void
  onOpen: (channel: Channel) => void
  onMarked: (channel: Channel) => void
}

export function channelView(options: ChannelViewOptions): HTMLElement {
  const visible = options.topFilter === 'top-only' ? options.channels.filter((item) => item.is_top)
    : options.topFilter === 'top-first' ? [...options.channels].sort((a, b) => Number(b.is_top) - Number(a.is_top))
      : options.channels
  const root = element('section', 'content')
  const heading = element('div', 'favorites-toolbar')
  const intro = element('div', 'favorite-page-title')
  intro.append(element('h1', '', 'Canais monitorados'),
    element('span', 'favorite-total', String(visible.length)))
  heading.append(intro)
  const form = element('form', 'favorite-toolbar-controls channel-toolbar-form')
  const topFilter = element('select', 'channel-top-filter')
  topFilter.setAttribute('aria-label', 'Filtrar canais tops')
  for (const [value, label] of [['all', 'Todos'], ['top-first', '+ Topzera'], ['top-only', 'Só Topzera']] as const) {
    const option = element('option', '', label)
    option.value = value
    topFilter.append(option)
  }
  topFilter.value = options.topFilter ?? 'all'
  topFilter.addEventListener('change', () => options.onTopFilter?.(topFilter.value as 'all' | 'top-first' | 'top-only'))
  const cards = new Map<string, HTMLElement>()
  const jump = channelPicker({ channels: visible, value: '', placeholder: 'Canais',
    label: 'Ir para canal cadastrado', className: 'channel-jump', disabled: visible.length === 0,
    onChange: (id) => {
      for (const [cardId, card] of cards) card.classList.toggle('channel-card-selected', cardId === id)
      const target = cards.get(id)
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } })
  const field = element('input')
  field.name = 'channel'
  field.type = 'text'
  field.required = true
  field.placeholder = 'URL, @handle ou ID UC…'
  field.setAttribute('aria-label', 'URL, arroba ou ID do canal')
  const submit = element('button', 'primary', 'Add Canal')
  submit.type = 'submit'
  submit.disabled = Boolean(options.busy)
  field.disabled = Boolean(options.busy)
  form.append(topFilter, jump, field, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    options.onAdd(field.value.trim())
  })
  heading.append(form)
  root.append(heading)
  const pending = options.requests.filter((item) => item.status !== 'resolved')
  if (pending.length) {
    const list = element('div', 'request-list')
    list.append(element('h2', '', 'Solicitações por @handle'))
    for (const item of pending) {
      const detail = item.status === 'pending' ? 'Aguardando próxima coleta' : (item.error_message ?? 'Falha na resolução')
      list.append(element('p', 'muted', `@${item.handle} · ${detail}`))
    }
    root.append(list)
  }
  if (!options.channels.length) {
    root.append(notice('Nenhum canal cadastrado. Adicione o primeiro para começar.'))
    return root
  }
  if (!visible.length) {
    root.append(notice('Nenhum canal top. Marque o troféu em um cartão para vê-lo aqui.'))
    return root
  }
  const list = element('div', 'channel-list')
  for (const channel of visible) {
    const count = options.videos.filter((video) => video.channel_id === channel.id && !video.state).length
    const item = element('article', `channel-card compact-channel-card${count ? ' has-news' : ''}${channel.is_active ? '' : ' is-paused'}${channel.is_top ? ' is-top' : ''}`)
    cards.set(channel.id, item)
    const head = element('div', 'channel-card-head')
    const avatar = element('div', 'avatar channel-card-avatar', channel.name.slice(0, 1).toUpperCase())
    if (channel.avatar_url) {
      const img = element('img')
      img.src = channel.avatar_url
      img.alt = ''
      img.referrerPolicy = 'no-referrer'
      img.addEventListener('error', () => img.remove())
      avatar.append(img)
    }
    const detail = element('div', 'channel-card-identity')
    const name = element('h2', '', channel.name)
    name.title = channel.name
    detail.append(name)
    const link = element('a', 'channel-link channel-youtube-link')
    link.href = `https://www.youtube.com/channel/${channel.youtube_channel_id}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = 'Ver canal no YouTube'
    link.setAttribute('aria-label', `Ver ${channel.name} no YouTube`)
    const youtubeIcon = element('span', 'channel-youtube-icon')
    youtubeIcon.style.maskImage = `url("${youtubeUrl}")`
    youtubeIcon.style.webkitMaskImage = `url("${youtubeUrl}")`
    link.append(youtubeIcon)
    detail.append(link)
    const trophy = button('', () => options.onTop(channel), `channel-top-button${channel.is_top ? ' is-top' : ''}`)
    trophy.title = channel.is_top ? 'Remover dos canais tops' : 'Marcar como canal top'
    trophy.setAttribute('aria-label', trophy.title)
    trophy.setAttribute('aria-pressed', String(channel.is_top))
    const trophyGlyph = element('span', 'channel-top-glyph')
    trophyGlyph.style.maskImage = `url("${trophyUrl}")`
    trophyGlyph.style.webkitMaskImage = `url("${trophyUrl}")`
    trophy.append(trophyGlyph)
    head.append(avatar, detail, trophy)
    const status = element('div', 'channel-card-status')
    const badge = channel.is_active ? count ? `+${count} novo${count === 1 ? '' : 's'}` : '0 novas' : 'Pausado'
    status.append(element('span', `channel-badge${channel.is_active ? count ? ' has-news' : '' : ' is-paused'}`, badge),
      element('span', 'channel-checked', checkedLabel(channel.last_checked_at)))
    const marked = button('Ver marcados', () => options.onMarked(channel), 'channel-marked-videos')
    marked.title = 'Ver vídeos classificados deste canal'
    const actions = element('div', 'channel-actions channel-card-actions')
    const view = button(count ? `Ver vídeos (${count})` : 'Ver vídeos', () => options.onOpen(channel),
      `channel-view-videos${count ? ' has-news' : ''}`)
    const toggle = button(channel.is_active ? '⏸' : '▶', () => options.onToggle(channel), 'channel-icon-button')
    toggle.title = channel.is_active ? 'Pausar monitoramento' : 'Reativar monitoramento'
    toggle.setAttribute('aria-label', toggle.title)
    const remove = button('🗑', () => options.onRemove(channel), 'channel-icon-button danger')
    remove.title = 'Remover canal'
    remove.setAttribute('aria-label', remove.title)
    actions.append(view, toggle, remove)
    item.append(head, status, marked, actions)
    list.append(item)
  }
  root.append(list)
  return root
}

function checkedLabel(value: string | null): string {
  if (!value) return 'Ainda não verificado'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return 'Verificação indisponível'
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000))
  if (minutes < 1) return 'Checado agora'
  if (minutes < 60) return `Há ${minutes} min`
  if (minutes < 1440) return `Há ${Math.floor(minutes / 60)} h`
  return `Checado em ${new Date(time).toLocaleDateString('pt-BR')}`
}
