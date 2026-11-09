export interface Route {
  page: 'favorites' | 'videos' | 'channels' | 'stories' | 'completed' | 'deprioritized' | 'queue' | 'summary' | 'usage'
  channelId: string
}

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'

export function routeFromHash(hash: string): Route {
  if (hash === '#favorites' || hash === '') return { page: 'favorites', channelId: '' }
  if (hash === '#channels') return { page: 'channels', channelId: '' }
  if (hash === '#stories') return { page: 'stories', channelId: '' }
  if (hash === '#completed') return { page: 'completed', channelId: '' }
  if (hash === '#deprioritized') return { page: 'deprioritized', channelId: '' }
  if (hash === '#queue') return { page: 'queue', channelId: '' }
  if (hash === '#summary') return { page: 'summary', channelId: '' }
  if (hash === '#usage') return { page: 'usage', channelId: '' }
  if (storySequenceId(hash)) return { page: 'videos', channelId: '' }
  const channelId = hash.match(new RegExp(`^#videos/(${uuid})(?:/marked)?$`))?.[1] ?? ''
  return hash === '#videos' || channelId
    ? { page: 'videos', channelId }
    : { page: 'favorites', channelId: '' }
}

export function channelRoute(id: string): string {
  if (!new RegExp(`^${uuid}$`).test(id)) throw new Error('ID de canal inválido.')
  return `#videos/${id}`
}

export function markedRoute(id: string): string { return `${channelRoute(id)}/marked` }
export function isMarkedRoute(hash: string): boolean { return hash.endsWith('/marked') && Boolean(routeFromHash(hash).channelId) }

export function storySequenceRoute(id: string): string {
  if (!new RegExp(`^${uuid}$`).test(id)) throw new Error('ID de história inválido.')
  return `#videos/story/${id}`
}
export function storySequenceId(hash: string): string {
  return hash.match(new RegExp(`^#videos/story/(${uuid})$`))?.[1] ?? ''
}
