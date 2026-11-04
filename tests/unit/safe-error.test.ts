import assert from 'node:assert/strict'
import test from 'node:test'
import { safeError } from '../../collector/jobs/safe-error.ts'

test('mensagens de erro não expõem credenciais nem URLs', () => {
  const old = process.env.YOUTUBE_API_KEY
  const oldSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
  const fakeSupabase = ['sb_secret_', 'nonreal_value'].join('')
  process.env.YOUTUBE_API_KEY = 'test-secret-value'
  process.env.SUPABASE_SERVICE_ROLE_KEY = fakeSupabase
  try {
    const result = safeError(new Error(`test-secret-value ${fakeSupabase} ` +
      'em https://example.com/?key=test-secret-value'))
    assert.equal(result.includes('test-secret-value'), false)
    assert.equal(result.includes(fakeSupabase), false)
    assert.equal(result.includes('https://'), false)
  } finally {
    if (old === undefined) delete process.env.YOUTUBE_API_KEY
    else process.env.YOUTUBE_API_KEY = old
    if (oldSupabase === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldSupabase
  }
})
