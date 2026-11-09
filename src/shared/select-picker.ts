import { channelPicker } from './channel-picker.ts'

export interface SelectChoice<T extends string> { value: T; label: string }

export function selectPicker<T extends string>(options: {
  choices: readonly SelectChoice<T>[]
  value: T
  label: string
  className?: string
  title?: string
  onChange: (value: T) => void
}): HTMLDivElement {
  const picker = channelPicker({
    channels: options.choices.map((choice) => ({
      id: choice.value, name: choice.label, is_top: false
    })),
    value: options.value,
    placeholder: options.choices[0]?.label ?? '',
    label: options.label,
    className: `custom-select ${options.className ?? ''}`,
    includePlaceholder: false,
    onChange: (value) => options.onChange(value as T)
  })
  if (options.title) picker.querySelector('.channel-picker-trigger')?.setAttribute('title', options.title)
  return picker
}
