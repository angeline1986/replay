import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl } from '../../shared/model.ts'
import type { YouTubeLookupResult, YouTubeResult } from '../../shared/saved-youtube.ts'

export function youtubeSearchView(
  mode: 'queue' | 'deprioritized' | 'completed', lookup: (input: string) => Promise<YouTubeLookupResult>,
  onSave: (video: YouTubeResult) => void, onReveal?: (youtubeId: string) => void
): HTMLElement {
  const section = element('section', 'youtube-search')
  const form = element('form', 'youtube-search-form')
  const input = element('input')
  input.type = 'url'
  input.required = true
  input.placeholder = 'Cole o link de um vídeo do YouTube'
  input.setAttribute('aria-label', 'Link de vídeo do YouTube')
  input.autocomplete = 'off'
  const submit = element('button', 'primary', 'Buscar no YouTube')
  submit.type = 'submit'
  form.append(input, submit)
  const result = element('div', 'youtube-search-result')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit.disabled = true
    submit.textContent = 'Buscando…'
    result.replaceChildren(notice('Procurando vídeo…'))
    void lookup(input.value).then((video) => {
      const preview = element('div', 'youtube-preview')
      const image = element('img')
      image.src = video.thumbnail_url
      image.alt = ''
      image.referrerPolicy = 'no-referrer'
      const imageLink = element('a', 'youtube-preview-link')
      imageLink.href = validVideoUrl(video.youtube_video_id)
      imageLink.target = '_blank'
      imageLink.rel = 'noopener noreferrer'
      imageLink.title = 'Abrir vídeo no YouTube'
      imageLink.setAttribute('aria-label', imageLink.title)
      imageLink.append(image)
      const info = element('div', 'youtube-preview-info')
      info.append(element('strong', '', video.title), element('span', '', video.channel_name))
      if (video.from_replay && !video.already_added) {
        info.append(element('span', 'youtube-local-note', 'Importado no RePlay; ainda fora desta lista.'))
      }
      const canReveal = Boolean(video.already_added && onReveal && mode !== 'completed')
      const action = button(video.already_added
        ? canReveal ? mode === 'queue' ? 'Mostrar na fila' : 'Mostrar nos despriorizados'
          : mode === 'queue' ? 'Já está na fila' : mode === 'completed' ? 'Já está nos concluídos' : 'Já está despriorizado'
        : mode === 'queue' ? 'Adicionar à fila' : mode === 'completed' ? 'Adicionar aos concluídos' : 'Despriorizar vídeo',
      () => canReveal ? onReveal?.(video.youtube_video_id) : onSave(video), 'primary')
      action.disabled = Boolean(video.already_added && !canReveal)
      info.append(action)
      preview.append(imageLink, info)
      result.replaceChildren(preview)
    }).catch((error: unknown) => {
      result.replaceChildren(notice(error instanceof Error ? error.message : 'Busca indisponível.', 'error'))
    }).finally(() => { submit.disabled = false; submit.textContent = 'Buscar no YouTube' })
  })
  section.append(form, result)
  return section
}
