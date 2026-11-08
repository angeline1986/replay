import { button, element, notice } from '../../shared/dom.ts'
import { validVideoUrl, type Channel, type Video } from '../../shared/model.ts'

function markedCard(video: Video): HTMLElement {
  const card = element('article', 'marked-video-card')
  const image = element('img')
  image.src = video.thumbnail_url
  image.alt = ''
  image.loading = 'lazy'
  image.referrerPolicy = 'no-referrer'
  const title = element('h3', '', video.title)
  const labels = element('div', 'marked-video-labels')
  for (const [flag, label] of [
    ['is_favorite', 'Favorito'], ['is_watched', 'Visto'],
    ['is_queued', 'Fila de espera'], ['is_deprioritized', 'Despriorizado']
  ] as const) if (video.state?.[flag]) labels.append(element('span', '', label))
  const link = element('a', 'video-link', 'Abrir no YouTube ↗')
  link.href = validVideoUrl(video.youtube_video_id)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  card.append(image, title, labels, link)
  return card
}

export async function openMarkedChannel(channel: Channel, load: () => Promise<Video[]>): Promise<void> {
  const dialog = element('dialog', 'marked-dialog')
  const header = element('div', 'marked-dialog-header')
  header.append(element('h2', '', `Vídeos marcados · ${channel.name}`))
  const close = button('Fechar', () => dialog.close(), 'ghost')
  header.append(close)
  const body = element('div', 'marked-dialog-body')
  body.append(notice('Carregando vídeos marcados…'))
  dialog.append(header, body)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  try {
    const videos = await load()
    if (!dialog.isConnected) return
    body.replaceChildren()
    if (!videos.length) { body.append(notice('Nenhum vídeo classificado neste canal.')); return }
    body.append(element('p', 'result-count', `${videos.length} vídeo${videos.length === 1 ? '' : 's'} classificado${videos.length === 1 ? '' : 's'}`))
    const grid = element('div', 'marked-video-grid')
    for (const video of videos) grid.append(markedCard(video))
    body.append(grid)
  } catch (error) {
    if (dialog.isConnected) body.replaceChildren(notice(error instanceof Error ? error.message : 'Não foi possível carregar os vídeos.', 'error'))
  }
}
