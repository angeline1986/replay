import { button, element } from '../../shared/dom.ts'
import type { Channel } from '../../shared/model.ts'

const trophyUrl = new URL('../../assets/icons/trophy-solid-full.svg', import.meta.url).href
const icons = {
  trophy: trophyUrl,
  pause: new URL('../../assets/icons/pause.svg', import.meta.url).href,
  play: new URL('../../assets/icons/play.svg', import.meta.url).href,
  trash: new URL('../../assets/icons/trash.svg', import.meta.url).href
}

export function channelCardMenu(channel: Channel, card: HTMLElement, actions: {
  onTop: () => void; onToggle: () => void; onRemove: () => void
}): HTMLElement {
  const root = element('div', 'channel-options')
  const trigger = button('⋯', () => toggle(), 'channel-options-trigger')
  trigger.title = 'Opções do canal'
  trigger.setAttribute('aria-label', `Opções de ${channel.name}`)
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  const menu = element('div', 'channel-options-menu')
  menu.setAttribute('role', 'menu')
  menu.hidden = true
  function close(): void {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    card.classList.remove('menu-open')
    document.removeEventListener('pointerdown', outside)
    document.removeEventListener('keydown', escape)
  }
  function outside(event: Event): void { if (!root.contains(event.target as Node)) close() }
  function escape(event: KeyboardEvent): void {
    if (event.key === 'Escape') { close(); trigger.focus() }
  }
  function toggle(): void {
    if (!menu.hidden) { close(); return }
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    card.classList.add('menu-open')
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  }
  function option(label: string, iconName: keyof typeof icons, action: () => void, danger = false): HTMLButtonElement {
    const item = button('', () => { close(); action() }, `channel-options-item${danger ? ' danger' : ''}`)
    item.setAttribute('role', 'menuitem')
    const icon = element('span', 'channel-options-icon')
    icon.setAttribute('aria-hidden', 'true')
    icon.style.maskImage = `url("${icons[iconName]}")`
    icon.style.webkitMaskImage = `url("${icons[iconName]}")`
    item.append(icon, element('span', '', label))
    return item
  }
  menu.append(option(channel.is_top ? 'Remover Topzera' : 'Marcar Topzera', 'trophy', actions.onTop),
    option(channel.is_active ? 'Pausar monitoramento' : 'Reativar monitoramento',
      channel.is_active ? 'pause' : 'play', actions.onToggle),
    option('Remover canal', 'trash', actions.onRemove, true))
  root.append(trigger, menu)
  return root
}
