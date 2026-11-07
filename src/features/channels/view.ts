import { button, element, notice } from '../../shared/dom.ts'
import type { Channel, ChannelRequest, Video } from '../../shared/model.ts'
import { statsView } from '../stats/view.ts'

interface ChannelViewOptions {
  channels: Channel[]
  requests: ChannelRequest[]
  videos: Video[]
  busy?: boolean
  onAdd: (input: string) => void
  onToggle: (channel: Channel) => void
  onRemove: (channel: Channel) => void
  onOpen: (channel: Channel) => void
}

export function channelView(options: ChannelViewOptions): HTMLElement {
  const root = element('section', 'content')
  const heading = element('div', 'page-head')
  const intro = element('div')
  intro.append(
    element('p', 'eyebrow', 'SEUS CANAIS'),
    element('h1', '', 'Canais monitorados'),
    element('p', 'subtitle', 'Veja cada canal cadastrado e seus últimos lançamentos.')
  )
  heading.append(intro)
  root.append(heading, statsView(options.channels, options.videos))
  const form = element('form', 'add-channel')
  const select = element('select', 'channel-jump')
  select.setAttribute('aria-label', 'Ir para canal cadastrado')
  const placeholder = element('option', '', 'Selecionar canal…')
  placeholder.value = ''
  select.append(placeholder)
  for (const item of options.channels) {
    const option = element('option', '', item.name)
    option.value = item.id
    select.append(option)
  }
  select.disabled = options.channels.length === 0
  const cards = new Map<string, HTMLElement>()
  select.addEventListener('change', () => {
    for (const [id, card] of cards) {
      card.classList.toggle('channel-card-selected', id === select.value)
    }
    const target = cards.get(select.value)
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
  const field = element('input')
  field.name = 'channel'
  field.type = 'text'
  field.required = true
  field.placeholder = 'URL, @handle ou ID UC…'
  field.setAttribute('aria-label', 'URL, arroba ou ID do canal')
  const submit = element('button', 'primary', 'Adicionar canal')
  submit.type = 'submit'
  submit.disabled = Boolean(options.busy)
  field.disabled = Boolean(options.busy)
  form.append(select, field, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    options.onAdd(field.value.trim())
  })
  root.append(form)
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
  const sectionTitle = element('div', 'section-title')
  sectionTitle.append(
    element('h2', '', 'Seus canais'),
    element('span', 'result-count', `${options.channels.length} canal${options.channels.length === 1 ? '' : 'is'}`)
  )
  root.append(sectionTitle)
  if (!options.channels.length) {
    root.append(notice('Nenhum canal cadastrado. Adicione o primeiro para começar.'))
    return root
  }
  const list = element('div', 'channel-list')
  for (const channel of options.channels) {
    const item = element('article', 'channel-card')
    cards.set(channel.id, item)
    const avatar = element('div', 'avatar', channel.name.slice(0, 1).toUpperCase())
    if (channel.avatar_url) {
      const img = element('img')
      img.src = channel.avatar_url
      img.alt = ''
      img.referrerPolicy = 'no-referrer'
      img.addEventListener('error', () => img.remove())
      avatar.replaceChildren(img)
    }
    item.append(avatar)
    const detail = element('div', 'channel-detail')
    detail.append(element('h2', '', channel.name))
    const count = options.videos.filter((video) => video.channel_id === channel.id && !video.state).length
    detail.append(element('p', 'muted', `${count} novidade${count === 1 ? '' : 's'} · ${channel.is_active ? 'Ativo' : 'Pausado'}`))
    const checked = channel.last_checked_at
      ? new Date(channel.last_checked_at).toLocaleString('pt-BR') : 'Ainda não verificado'
    detail.append(element('p', 'muted small', `Última verificação: ${checked}`))
    const link = element('a', 'channel-link', 'Ver no YouTube ↗')
    link.href = `https://www.youtube.com/channel/${channel.youtube_channel_id}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    detail.append(link)
    item.append(detail)
    const actions = element('div', 'channel-actions')
    actions.append(
      button('Ver vídeos', () => options.onOpen(channel)),
      button(channel.is_active ? 'Pausar' : 'Reativar', () => options.onToggle(channel)),
      button('Remover', () => options.onRemove(channel), 'danger')
    )
    item.append(actions)
    list.append(item)
  }
  root.append(list)
  return root
}
