import { button, element } from '../shared/dom.ts'
import type { Route } from './route.ts'

export function sidebarView(page: Route['page'], showNav: boolean): HTMLElement {
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
      ['channels', '▣', 'Canais monitorados'],
      ['videos', '▷', 'Últimos lançamentos']
    ] as const) {
      const link = element('a', '', `${symbol}  ${label}`)
      link.href = `#${route}`
      if (page === route) link.setAttribute('aria-current', 'page')
      nav.append(link)
    }
    sidebar.append(nav)
  }
  sidebar.append(element('p', 'sidebar-footer', 'RePlay · seus canais, no seu ritmo.'))
  return sidebar
}

export function accountBar(email: string, onSignOut: () => void): HTMLElement {
  const bar = element('header', 'account-bar')
  if (!email) return bar
  bar.append(element('span', 'user-email', email), button('Sair', onSignOut, 'ghost'))
  return bar
}
