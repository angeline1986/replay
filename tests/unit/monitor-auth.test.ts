import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyOwner } from '../../supabase/functions/monitor-control/auth.ts'
import { HttpError } from '../../supabase/functions/monitor-control/handler.ts'

test('backend exige usuário autenticado e role owner', async () => {
  let reads = 0
  const role = async () => { reads++; return 'owner' }
  await assert.rejects(verifyOwner(async () => null, role),
    (error: HttpError) => error.status === 401)
  assert.equal(reads, 0)
  await assert.rejects(verifyOwner(async () => ({ id: 'user' }), async () => 'admin'),
    (error: HttpError) => error.status === 403)
  assert.equal(await verifyOwner(async () => ({ id: 'owner' }), role), 'owner')
  assert.equal(reads, 1)
})
