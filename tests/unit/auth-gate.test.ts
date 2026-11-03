import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthGate } from '../../src/app/auth-gate.ts'

type User = { id: string; email: string }
const owner: User = { id: 'owner-id', email: 'owner@example.com' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('refresh com sessão válida mantém loading até recuperar o usuário', async () => {
  const pending = deferred<User | null>()
  const commits: Array<User | null> = []
  let reads = 0
  const gate = createAuthGate({
    load: () => { reads += 1; return pending.promise },
    commit: (value) => commits.push(value),
    onError: () => assert.fail('não deveria falhar'),
    onChange: () => {}
  })
  const start = gate.start()
  assert.equal(gate.phase, 'initializing')
  assert.deepEqual(commits, [])
  gate.handle('INITIAL_SESSION', owner.id)
  gate.handle('SIGNED_IN', owner.id)
  gate.handle('TOKEN_REFRESHED', owner.id)
  pending.resolve(owner)
  await start
  assert.equal(gate.phase, 'signed_in')
  assert.deepEqual(commits, [owner])
  assert.equal(reads, 1)
  gate.handle('TOKEN_REFRESHED', owner.id)
  gate.handle('SIGNED_IN', owner.id)
  await gate.start()
  assert.equal(gate.phase, 'signed_in')
  assert.equal(reads, 1)
  assert.deepEqual(commits, [owner])
})

test('refresh sem sessão mostra login somente após confirmar ausência', async () => {
  const pending = deferred<User | null>()
  const commits: Array<User | null> = []
  const gate = createAuthGate({
    load: () => pending.promise,
    commit: (value) => commits.push(value),
    onError: () => assert.fail('não deveria falhar'),
    onChange: () => {}
  })
  const start = gate.start()
  assert.equal(gate.phase, 'initializing')
  assert.deepEqual(commits, [])
  pending.resolve(null)
  await start
  assert.equal(gate.phase, 'signed_out')
  assert.deepEqual(commits, [null])
})

test('login durante recuperação serializa leituras sem mostrar login transitório', async () => {
  const first = deferred<User | null>()
  const second = deferred<User | null>()
  const commits: Array<User | null> = []
  let reads = 0
  let active = 0
  let maximum = 0
  const gate = createAuthGate({
    load: async () => {
      const pending = ++reads === 1 ? first : second
      maximum = Math.max(maximum, ++active)
      try { return await pending.promise }
      finally { active -= 1 }
    },
    commit: (value) => commits.push(value),
    onError: () => assert.fail('não deveria falhar'),
    onChange: () => {}
  })
  const start = gate.start()
  gate.handle('SIGNED_IN', owner.id)
  gate.handle('TOKEN_REFRESHED', owner.id)
  first.resolve(null)
  await start
  assert.equal(gate.phase, 'initializing')
  assert.deepEqual(commits, [])
  assert.equal(reads, 2)
  second.resolve(owner)
  await new Promise<void>((done) => setImmediate(done))
  assert.equal(gate.phase, 'signed_in')
  assert.deepEqual(commits, [owner])
  assert.equal(maximum, 1)
})

test('logout durante recuperação descarta resultado atrasado', async () => {
  const pending = deferred<User | null>()
  const commits: Array<User | null> = []
  const gate = createAuthGate({
    load: () => pending.promise,
    commit: (value) => commits.push(value),
    onError: () => assert.fail('não deveria falhar'),
    onChange: () => {}
  })
  const start = gate.start()
  gate.handle('SIGNED_OUT')
  pending.resolve(owner)
  await start
  assert.equal(gate.phase, 'signed_out')
  assert.deepEqual(commits, [null])
})

test('falha ao verificar sessão não é tratada como ausência de login', async () => {
  const commits: Array<User | null> = []
  const errors: unknown[] = []
  let attempts = 0
  const gate = createAuthGate({
    load: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('rede indisponível')
      return owner
    },
    commit: (value) => commits.push(value),
    onError: (error) => errors.push(error),
    onChange: () => {}
  })
  await gate.start()
  assert.equal(gate.phase, 'error')
  assert.deepEqual(commits, [])
  assert.equal(errors.length, 1)
  await gate.retry()
  assert.equal(gate.phase, 'signed_in')
  assert.deepEqual(commits, [owner])
})
