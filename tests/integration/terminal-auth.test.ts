import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { browserSignIn } from '../../cli/auth.ts'

test('callback PKCE local recebe o código sem mostrá-lo na página', async () => {
  let exchanged = ''
  const client = { auth: {
    signInWithOAuth: async () => ({ data: { url: 'https://example.test/login' }, error: null }),
    exchangeCodeForSession: async (code: string) => {
      exchanged = code
      return { data: { session: { access_token: 'test' } }, error: null }
    }
  } } as unknown as SupabaseClient
  await browserSignIn(client, async () => {
    const invalid = await fetch('http://localhost:5173/other?code=test')
    assert.equal(invalid.status, 404)
    const response = await fetch('http://localhost:5173/replay/?code=one-time-code')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.doesNotMatch(await response.text(), /one-time-code/)
  })
  assert.equal(exchanged, 'one-time-code')
})
