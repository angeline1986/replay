import { button, element, notice } from '../../shared/dom.ts'
import type { YouTubeResult } from '../../shared/saved-youtube.ts'

export function youtubeSearchView(
  mode: 'queue' | 'deprioritized', lookup: (input: string) => Promise<YouTubeResult>,
  onSave: (video: YouTubeResult) => void
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
    result.replaceChildren(notice('Consultando vídeo no YouTube…'))
    void lookup(input.value).then((video) => {
      const preview = element('div', 'youtube-preview')
      const image = element('img')
      image.src = video.thumbnail_url
      image.alt = ''
      image.referrerPolicy = 'no-referrer'
      const info = element('div', 'youtube-preview-info')
      info.append(element('strong', '', video.title), element('span', '', video.channel_name))
      info.append(button(mode === 'queue' ? 'Adicionar à fila' : 'Despriorizar vídeo',
        () => onSave(video), 'primary'))
      preview.append(image, info)
      result.replaceChildren(preview)
    }).catch((error: unknown) => {
      result.replaceChildren(notice(error instanceof Error ? error.message : 'Busca indisponível.', 'error'))
    }).finally(() => { submit.disabled = false; submit.textContent = 'Buscar no YouTube' })
  })
  section.append(form, result)
  return section
}
