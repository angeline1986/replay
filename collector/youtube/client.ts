export const MAX_ACTIVE_CHANNELS = 100
export const MAX_PAGES_PER_CHANNEL = 2
export const MAX_API_CALLS = Math.ceil(MAX_ACTIVE_CHANNELS / 50) +
  MAX_ACTIVE_CHANNELS * MAX_PAGES_PER_CHANNEL

export class QuotaError extends Error {}

export class ApiBudget {
  used = 0
  readonly limit: number
  constructor(limit = MAX_API_CALLS) { this.limit = limit }

  spend(): void {
    if (this.used >= this.limit) throw new QuotaError('Limite local de chamadas YouTube atingido.')
    this.used++
  }
}

export async function youtubeGet<T>(
  endpoint: 'channels' | 'playlistItems',
  params: Record<string, string>,
  key: string,
  budget: ApiBudget,
  fetcher: typeof fetch = fetch
): Promise<T> {
  if (!key) throw new Error('YOUTUBE_API_KEY ausente.')
  budget.spend()
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  url.searchParams.set('key', key)
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) {
    let reason = ''
    try {
      const body = await response.json() as { error?: { errors?: Array<{ reason?: string }> } }
      reason = body.error?.errors?.[0]?.reason ?? ''
    } catch { /* A resposta pode não ser JSON. */ }
    if (response.status === 429 || /quotaExceeded|dailyLimitExceeded|rateLimitExceeded/.test(reason)) {
      throw new QuotaError(`Cota YouTube indisponível (HTTP ${response.status}).`)
    }
    throw new Error(`YouTube API HTTP ${response.status}.`)
  }
  try { return await response.json() as T }
  catch { throw new Error('Resposta JSON inválida da YouTube API.') }
}
