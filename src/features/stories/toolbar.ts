import { element } from '../../shared/dom.ts'
import { channelPicker } from '../../shared/channel-picker.ts'
import { selectPicker } from '../../shared/select-picker.ts'
import type { Channel } from '../../shared/model.ts'
import type { StoryGroup } from '../../shared/story-model.ts'
import { storyChannelId } from './groups.ts'

export function storyToolbar(options: {
  source: StoryGroup[]
  channels: Channel[]
  completed: boolean
  selectedChannelId: string
  onChannelSelect: (id: string) => void
  query: string
  onQuery: (value: string) => void
  sort: 'recent' | 'az'
  onSort: (value: 'recent' | 'az') => void
}): HTMLElement {
  const controls = element('div', 'favorite-toolbar-controls')
  if (options.completed) {
    const search = element('input')
    search.type = 'search'
    search.placeholder = '⌕  Buscar história ou canal...'
    search.setAttribute('aria-label', 'Buscar histórias concluídas')
    search.value = options.query
    search.addEventListener('input', () => {
      const caret = search.selectionStart
      options.onQuery(search.value)
      const next = document.querySelector<HTMLInputElement>('[aria-label="Buscar histórias concluídas"]')
      next?.focus()
      if (caret !== null) next?.setSelectionRange(caret, caret)
    })
    controls.append(search)
  }
  const choices = [...new Set(options.source.map(storyChannelId))].map((id) => {
    const group = options.source.find((item) => storyChannelId(item) === id)!
    const channel = options.channels.find((item) => item.id === id)
    return { id, name: channel?.name ?? (group.seed ?? group.confirmed[0]?.video)?.channel?.name ?? 'Canal',
      is_top: Boolean(channel?.is_top) }
  })
  controls.append(channelPicker({ channels: choices, value: options.selectedChannelId,
    placeholder: 'Canais',
    label: options.completed ? 'Filtrar concluídos por canal' : 'Filtrar histórias por canal',
    className: 'favorite-channel-filter', onChange: options.onChannelSelect }))
  controls.append(selectPicker({
    choices: [{ value: 'recent', label: 'Recentes' }, { value: 'az', label: 'A–Z' }],
    value: options.sort,
    label: options.completed ? 'Ordenar histórias concluídas' : 'Ordenar minhas histórias',
    className: 'favorite-sort', onChange: options.onSort
  }))
  return controls
}
