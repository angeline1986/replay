export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.textContent = text
  return node
}

export function button(text: string, action: () => void, className = ''): HTMLButtonElement {
  const node = element('button', className, text)
  node.type = 'button'
  node.addEventListener('click', action)
  return node
}

export function clear(node: HTMLElement): void {
  node.replaceChildren()
}

export function notice(text: string, kind = ''): HTMLElement {
  const node = element('p', `notice ${kind}`, text)
  node.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  return node
}
