import type { Channel } from '../../shared/model.ts'

export function confirmBulk(channels: Channel[], active: boolean,
  ask: (message: string) => boolean): number | null {
  const count = channels.filter((channel) => channel.is_active !== active).length
  if (!count) return null
  const action = active ? 'Ativar' : 'Pausar'
  return ask(`${action} ${count} canal${count === 1 ? '' : 'is'}?`) ? count : null
}
