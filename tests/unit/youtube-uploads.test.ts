import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiBudget } from '../../collector/youtube/client.ts'
import { fetchUploads, uploadPlaylists } from '../../collector/youtube/uploads.ts'

const channelId = 'UC1234567890123456789012'
const video = (id: string, privacyStatus = 'public') => ({
  contentDetails: { videoId: id, videoPublishedAt: '2026-11-02T10:00:00Z' },
  snippet: { title: 'Vídeo real', videoOwnerChannelId: channelId },
  status: { privacyStatus }
})

test('62 IDs canônicos são resolvidos em duas chamadas de channels.list', async () => {
  const ids = Array.from({ length: 62 }, (_, i) => `UC${String(i).padStart(22, '0')}`)
  const requests: URL[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    requests.push(url)
    return Response.json({ items: url.searchParams.get('id')?.split(',').map((id) => ({
      id, contentDetails: { relatedPlaylists: { uploads: `UU${id.slice(2)}` } }
    })) })
  }) as typeof fetch
  const budget = new ApiBudget()
  const playlists = await uploadPlaylists(ids, 'test-key', budget, fetcher)
  assert.equal(playlists.size, 62)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].searchParams.get('part'), 'contentDetails')
  assert.equal(requests[0].searchParams.get('maxResults'), '50')
  assert.equal(budget.used, 2)
})

test('playlist lê no máximo duas páginas, filtra privados e deduplica IDs', async () => {
  const requests: URL[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    requests.push(url)
    return Response.json(requests.length === 1 ? {
      items: [video('abcdefghijk'), video('private0001', 'private'),
        { ...video('deleted0001'), snippet: { title: 'Deleted video' } }],
      nextPageToken: 'page-2'
    } : { items: [video('abcdefghijk'), video('lmnopqrstuv')], nextPageToken: 'page-3' })
  }) as typeof fetch
  const budget = new ApiBudget()
  const uploads = await fetchUploads('UU123', channelId, 'test-key', budget, fetcher)
  assert.deepEqual(uploads.videos.map((item) => item.youtube_video_id),
    ['abcdefghijk', 'lmnopqrstuv'])
  assert.equal(uploads.videos[0].published_at, '2026-11-02T10:00:00.000Z')
  assert.equal(requests.length, 2)
  assert.equal(requests[1].searchParams.get('pageToken'), 'page-2')
  assert.equal(requests[0].searchParams.get('maxResults'), '50')
  assert.equal(budget.used, 2)
})

test('resposta inválida e paginação repetida falham sem persistência', async () => {
  const invalid = (async () => Response.json({ wrong: [] })) as typeof fetch
  await assert.rejects(fetchUploads('UU123', channelId, 'test-key', new ApiBudget(), invalid),
    /playlist inválida/)
  const repeated = (async () => Response.json({ items: [], nextPageToken: 'same' })) as typeof fetch
  await assert.rejects(fetchUploads('UU123', channelId, 'test-key', new ApiBudget(), repeated),
    /Paginação repetida/)
})
