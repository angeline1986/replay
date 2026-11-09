import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Video } from '../../shared/model.ts'
import type { YouTubeResult } from '../../shared/saved-youtube.ts'

export interface FindVideoOptions {
  target: 'favorites' | 'stories'
  searchReplay: (input: string) => Promise<Video[]>
  searchYouTube: (input: string) => Promise<YouTubeResult>
  isAdded: (youtubeId: string) => boolean
  selectReplay: (video: Video) => Promise<void>
  selectYouTube: (video: YouTubeResult) => Promise<void>
  showAdded: (youtubeId: string) => void
}

export function findVideoMenu(options: FindVideoOptions): HTMLElement {
  const root = element('div', 'find-video-menu')
  const trigger = button('⋯', () => toggleMenu(), 'find-video-trigger')
  trigger.title = 'Encontrar vídeo'
  trigger.setAttribute('aria-label', 'Encontrar vídeo')
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  const menu = element('div', 'find-video-options')
  menu.setAttribute('role', 'menu')
  menu.hidden = true
  const panel = element('section', 'find-video-panel')
  panel.hidden = true
  const title = element('strong', '', 'Buscar no RePlay')
  let requestId = 0
  const closePanel = button('×', () => { requestId++; panel.hidden = true; trigger.focus() }, 'find-video-close')
  closePanel.setAttribute('aria-label', 'Fechar busca de vídeo')
  const head = element('div', 'find-video-head')
  head.append(title, closePanel)
  const form = element('form', 'find-video-form')
  const input = element('input')
  input.required = true
  input.autocomplete = 'off'
  const submit = element('button', 'primary', 'Buscar')
  submit.type = 'submit'
  form.append(input, submit)
  const results = element('div', 'find-video-results')
  panel.append(head, form, results)
  let source: 'replay' | 'youtube' = 'replay'
  function closeMenu(): void {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', outside)
    document.removeEventListener('keydown', escape)
  }
  function outside(event: Event): void { if (!root.contains(event.target as Node)) closeMenu() }
  function escape(event: KeyboardEvent): void {
    if (event.key === 'Escape') { closeMenu(); trigger.focus() }
  }
  function toggleMenu(): void {
    if (!menu.hidden) { closeMenu(); return }
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  }
  function open(next: typeof source): void {
    closeMenu()
    requestId++
    source = next
    title.textContent = next === 'replay' ? 'Buscar no RePlay' : 'Buscar no YouTube'
    input.type = next === 'replay' ? 'search' : 'url'
    input.placeholder = next === 'replay' ? 'Título ou link do vídeo' : 'Cole o link do vídeo do YouTube'
    input.setAttribute('aria-label', input.placeholder)
    input.value = ''
    results.replaceChildren()
    panel.hidden = false
    submit.disabled = false
    input.focus()
  }
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel.click()
  })
  for (const [label, kind] of [['Buscar no RePlay', 'replay'], ['Buscar no YouTube', 'youtube']] as const) {
    const item = button(label, () => open(kind), 'find-video-option')
    item.setAttribute('role', 'menuitem')
    menu.append(item)
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit.disabled = true
    results.replaceChildren(notice('Buscando vídeo…'))
    const kind = source
    const current = ++requestId
    const request = kind === 'replay' ? options.searchReplay(input.value)
      : options.searchYouTube(input.value).then((video) => [video])
    void request.then((videos) => {
      if (current !== requestId || panel.hidden) return
      results.replaceChildren()
      if (!videos.length) { results.append(notice('Nenhum vídeo encontrado no RePlay.')); return }
      for (const video of videos) results.append(resultRow(video, kind, options, results))
    }).catch((error: unknown) => {
      if (current !== requestId || panel.hidden) return
      results.replaceChildren(notice(error instanceof Error ? error.message : 'Busca indisponível.', 'error'))
    }).finally(() => { if (current === requestId) submit.disabled = false })
  })
  root.append(trigger, menu, panel)
  return root
}

function resultRow(
  video: Video | YouTubeResult, source: 'replay' | 'youtube',
  options: FindVideoOptions, results: HTMLElement
): HTMLElement {
  const row = element('div', 'find-video-result')
  const link = element('a', 'find-video-art')
  link.href = validVideoUrl(video.youtube_video_id)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = 'Abrir vídeo no YouTube'
  const image = element('img')
  image.src = video.thumbnail_url
  image.alt = ''
  image.referrerPolicy = 'no-referrer'
  link.append(image)
  const info = element('div', 'find-video-info')
  const channel = 'channel_name' in video ? video.channel_name : video.channel?.name ?? 'Canal'
  info.append(element('strong', '', video.title), element('span', '', channel))
  const added = options.isAdded(video.youtube_video_id)
  const label = added ? 'Mostrar na página' : options.target === 'favorites' ? 'Favoritar' : 'Acompanhar'
  const action = button(label, () => {
    if (added) { options.showAdded(video.youtube_video_id); return }
    action.disabled = true
    void (source === 'replay' ? options.selectReplay(video as Video)
      : options.selectYouTube(video as YouTubeResult)).catch((error: unknown) => {
      results.prepend(notice(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error'))
      action.disabled = false
    })
  }, added ? 'ghost' : 'primary')
  info.append(action)
  row.append(link, info)
  return row
}
