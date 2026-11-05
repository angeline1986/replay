import assert from 'node:assert/strict'
import test from 'node:test'
import { callbackRequest } from '../../cli/auth.ts'

test('callback local aceita apenas o caminho esperado e código curto', () => {
  const valid = callbackRequest('localhost:5173', 'GET', '/replay/?code=one-time-code')
  assert.deepEqual(valid, { valid: true, code: 'one-time-code', denied: false })
  assert.equal(callbackRequest('localhost:5173', 'GET', '/other?code=test').valid, false)
  assert.equal(callbackRequest('evil.test', 'GET', '/replay/?code=test').valid, false)
  assert.equal(callbackRequest('localhost:5173', 'POST', '/replay/?code=test').valid, false)
  assert.equal(callbackRequest('localhost:5173', 'GET', `/replay/?code=${'x'.repeat(4097)}`).code, null)
  assert.equal(callbackRequest('localhost:5173', 'GET', '/replay/?error=access_denied').denied, true)
})
