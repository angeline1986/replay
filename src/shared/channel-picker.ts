import { button, element } from './dom.ts'
import type { Channel } from './model.ts'

type Choice = Pick<Channel, 'id' | 'name' | 'is_top'>
const trophyUrl = new URL('../assets/icons/trophy-solid-full.svg', import.meta.url).href

export function channelPicker(options: {
  channels: Choice[]
  value: string
  placeholder: string
  label: string
  className?: string
  disabled?: boolean
  onChange: (id: string) => void
}): HTMLDivElement {
  const root = element('div', `channel-picker ${options.className ?? ''}`)
  const trigger = button('', () => toggle(), 'channel-picker-trigger')
  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-label', options.label)
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.disabled = Boolean(options.disabled)
  const menu = element('div', 'channel-picker-menu')
  menu.setAttribute('role', 'listbox')
  menu.setAttribute('aria-label', options.label)
  menu.hidden = true
  const choices = [{ id: '', name: options.placeholder, is_top: false }, ...options.channels]
  let selected = options.value
  const nodes: HTMLButtonElement[] = []
  const trophy = () => {
    const icon = element('span', 'channel-picker-trophy')
    icon.style.maskImage = `url("${trophyUrl}")`
    icon.style.webkitMaskImage = `url("${trophyUrl}")`
    icon.setAttribute('aria-hidden', 'true')
    return icon
  }
  const label = (choice: Choice) => {
    const content = element('span', 'channel-picker-label')
    if (choice.is_top) content.append(trophy())
    content.append(element('span', '', choice.name))
    return content
  }
  function update(): void {
    const choice = choices.find((item) => item.id === selected) ?? choices[0]
    trigger.replaceChildren(label(choice))
    trigger.title = choice.name
    for (const node of nodes) node.setAttribute('aria-selected', String(node.dataset.channelId === selected))
  }
  function close(): void { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false') }
  function toggle(): void {
    menu.hidden = !menu.hidden
    trigger.setAttribute('aria-expanded', String(!menu.hidden))
  }
  for (const choice of choices) {
    const option = button('', () => {
      selected = choice.id
      update(); close(); trigger.focus()
      options.onChange(choice.id)
    }, 'channel-picker-option')
    option.dataset.channelId = choice.id
    option.title = choice.name
    option.setAttribute('role', 'option')
    option.append(label(choice))
    nodes.push(option)
    menu.append(option)
  }
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    menu.hidden = false; trigger.setAttribute('aria-expanded', 'true')
    nodes[Math.max(0, nodes.findIndex((item) => item.dataset.channelId === selected))]?.focus()
  })
  menu.addEventListener('keydown', (event) => {
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { close(); trigger.focus(); return }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    nodes[(current + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus()
  })
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget as Node | null)) close()
  })
  update()
  root.append(trigger, menu)
  return root
}
