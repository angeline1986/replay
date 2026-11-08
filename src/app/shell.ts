import { button, element } from '../shared/dom.ts'
import type { Route } from './route.ts'

export function sidebarView(
  page: Route['page'], showNav: boolean, pendingStories = 0, onSignOut?: () => void
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
      ['deprioritized', '♥̸', 'Despriorizados'],
      ['queue', '⌛', 'Fila de espera'],
      ['stories', '◈', 'Minhas histórias'],
      ['channels', '▣', 'Canais monitorados'],
      ['videos', '▷', 'Últimos lançamentos']
    ] as const) {
      const count = route === 'stories' && pendingStories ? ` (${pendingStories})` : ''
      const link = element('a', '', `${symbol}  ${label}${count}`)
      link.href = `#${route}`
      if (page === route) link.setAttribute('aria-current', 'page')
      nav.append(link)
    }
    sidebar.append(nav)
  }
  if (showNav && onSignOut) sidebar.append(button('Sair', onSignOut, 'ghost sidebar-logout'))
  return sidebar
}
