import assert from 'node:assert/strict'
import test from 'node:test'

test('execução completa sem canais ativos termina sem chamadas YouTube ou escrita', async () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const originalYoutubeKey = process.env.YOUTUBE_API_KEY
  process.env.SUPABASE_URL = 'https://local.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key'
  process.env.YOUTUBE_API_KEY = 'local-test-key'
  const paths: string[] = []
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.hostname, 'local.invalid')
    assert.equal(init?.method, 'GET')
    paths.push(url.pathname)
    return Response.json([])
  }) as typeof fetch
  try {
    await import('../../collector/jobs/main.ts')
    assert.deepEqual(paths, ['/rest/v1/channels', '/rest/v1/channel_requests'])
    assert.notEqual(process.exitCode, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    if (originalYoutubeKey === undefined) delete process.env.YOUTUBE_API_KEY
    else process.env.YOUTUBE_API_KEY = originalYoutubeKey
  }
})
