export interface Route {
  page: 'videos' | 'channels'
  channelId: string
}

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'

export function routeFromHash(hash: string): Route {
  if (hash === '#channels') return { page: 'channels', channelId: '' }
  const channelId = hash.match(new RegExp(`^#videos/(${uuid})$`))?.[1] ?? ''
  return { page: 'videos', channelId }
}

export function channelRoute(id: string): string {
  if (!new RegExp(`^${uuid}$`).test(id)) throw new Error('ID de canal inválido.')
  return `#videos/${id}`
}
