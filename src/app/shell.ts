import { button, element } from '../shared/dom.ts'
import { iconGlyph } from '../features/videos/icons.ts'
import type { Route } from './route.ts'

export function sidebarView(
  page: Route['page'], showNav: boolean, onSignOut?: () => void
): HTMLElement {
  const sidebar = element('aside', 'sidebar')
  const brand = element('a', 'brand')
  brand.href = '#favorites'
  brand.append(element('span', 'brand-icon', '▶'), element('span', '', 'RePlay'))
  sidebar.append(brand, element('p', 'brand-subtitle', 'SEUS VÍDEOS, SEUS CANAIS'))
  if (showNav) {
    const nav = element('nav', 'nav')
    nav.setAttribute('aria-label', 'Navegação principal')
    for (const [route, symbol, label] of [
      ['favorites', '★', 'Vídeos favoritos'],
      ['stories', '◈', 'Minhas histórias'],
      ['channels', '▣', 'Canais monitorados'],
      ['videos', '▷', 'Lançamentos'],
      ['completed', '✓', 'Concluídos'],
      ['queue', '', 'Fila de espera'],
      ['deprioritized', '', 'Despriorizados'],
      ['summary', '▤', 'Resumo'],
      ['usage', '▥', 'Consumo']
    ] as const) {
      const link = element('a')
      const icon = element('span', 'nav-icon', symbol)
      icon.setAttribute('aria-hidden', 'true')
      if (route === 'queue') icon.append(iconGlyph('hourglass'))
      if (route === 'deprioritized') icon.append(iconGlyph('heart-crack'))
      link.append(icon, element('span', '', label))
      link.href = `#${route}`
      if (page === route) link.setAttribute('aria-current', 'page')
      nav.append(link)
    }
    sidebar.append(nav)
  }
  if (showNav && onSignOut) sidebar.append(button('Sair', onSignOut, 'primary sidebar-logout'))
  return sidebar
}
