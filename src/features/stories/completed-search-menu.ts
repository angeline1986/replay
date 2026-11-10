import { button, element } from '../../shared/dom.ts'
import { youtubeSearchView } from '../videos/youtube-search.ts'
import type { YouTubeLookupResult, YouTubeResult } from '../../shared/saved-youtube.ts'

export function completedSearchMenu(
  lookup: (input: string) => Promise<YouTubeLookupResult>,
  onSave: (video: YouTubeResult) => void
): HTMLElement {
  const root = element('div', 'find-video-menu completed-search-menu')
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
  const trigger = button('⋯', () => {
    if (!menu.hidden) { closeMenu(); return }
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
  }, 'find-video-trigger')
  trigger.title = 'Encontrar vídeo'
  trigger.setAttribute('aria-label', 'Encontrar vídeo')
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  const menu = element('div', 'find-video-options')
  menu.setAttribute('role', 'menu')
  menu.hidden = true
  const panel = element('section', 'find-video-panel')
  panel.hidden = true
  const close = button('×', () => { panel.hidden = true; trigger.focus() }, 'find-video-close')
  close.setAttribute('aria-label', 'Fechar busca de vídeo')
  const head = element('div', 'find-video-head')
  head.append(element('strong', '', 'Buscar no YouTube'), close)
  panel.append(head, youtubeSearchView('completed', lookup, onSave))
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') close.click() })
  const option = button('Buscar no YouTube', () => {
    closeMenu()
    panel.hidden = false
    panel.querySelector<HTMLInputElement>('input')?.focus()
  }, 'find-video-option')
  option.setAttribute('role', 'menuitem')
  menu.append(option)
  root.append(trigger, menu, panel)
  return root
}
