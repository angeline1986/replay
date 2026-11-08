export interface Route {
  page: 'favorites' | 'videos' | 'channels' | 'stories' | 'deprioritized' | 'queue'
  channelId: string
}

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'

export function routeFromHash(hash: string): Route {
  if (hash === '#favorites' || hash === '') return { page: 'favorites', channelId: '' }
  if (hash === '#channels') return { page: 'channels', channelId: '' }
  if (hash === '#stories') return { page: 'stories', channelId: '' }
  if (hash === '#deprioritized') return { page: 'deprioritized', channelId: '' }
  if (hash === '#queue') return { page: 'queue', channelId: '' }
  const channelId = hash.match(new RegExp(`^#videos/(${uuid})$`))?.[1] ?? ''
  return hash === '#videos' || channelId
    ? { page: 'videos', channelId }
    : { page: 'favorites', channelId: '' }
}

export function channelRoute(id: string): string {
  if (!new RegExp(`^${uuid}$`).test(id)) throw new Error('ID de canal inválido.')
  return `#videos/${id}`
}
