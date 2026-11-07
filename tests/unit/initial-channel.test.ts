import assert from 'node:assert/strict'
import test from 'node:test'
import { importInitialChannel, type ChannelIdentity, type InitialImportDeps } from '../../collector/jobs/initial-channel.ts'

const id = 'UC' + 'a'.repeat(22)
const identity: ChannelIdentity = { youtube_channel_id: id, name: 'Canal', avatar_url: null }
const stored = { ...identity, id: 'row-1', is_active: true }

function fixture() {
  const calls: string[] = []
  let existing = false
  let active = 0
  const deps: InitialImportDeps<string[]> = {
    async resolveHandle(handle) { calls.push('resolve:' + handle); return identity },
    async resolveId(channelId) { calls.push('resolve-id:' + channelId); return identity },
    async countActive() { calls.push('count'); return active },
    async findChannel() { calls.push('find'); return existing ? stored : null },
    async createChannel() { calls.push('create'); return stored },
    async fetchUploads() { calls.push('fetch'); return ['v1', 'v2'] },
    async saveUploads() { calls.push('save'); return 2 }
  }
  return { calls, deps, setExisting: () => { existing = true }, setFull: () => { active = 100 } }
}

test('handle novo resolve e importa somente um canal', async () => {
  const { calls, deps } = fixture()
  const result = await importInitialChannel({ ownerId: 'u1', handle: 'MestredoKimchi' }, deps)
  assert.equal(result.status, 'imported')
  assert.equal(result.importedVideos, 2)
  assert.deepEqual(calls, ['resolve:MestredoKimchi', 'find', 'count', 'create', 'fetch', 'save'])
})

test('canal existente não dispara coleta repetida', async () => {
  const { calls, deps, setExisting } = fixture()
  setExisting()
  const result = await importInitialChannel({ ownerId: 'u1', channelId: id }, deps)
  assert.equal(result.status, 'already_monitored')
  assert.deepEqual(calls, ['resolve-id:' + id, 'find'])
})

test('recusa novo canal quando há 100 ativos', async () => {
  const { calls, deps, setFull } = fixture()
  setFull()
  await assert.rejects(() => importInitialChannel({ ownerId: 'u1', handle: 'canal123' }, deps), /100 canais/)
  assert.equal(calls.includes('create'), false)
})

test('validação rejeita entrada inválida antes de qualquer operação', async () => {
  const { calls, deps } = fixture()
  await assert.rejects(() => importInitialChannel({ ownerId: '', handle: 'abc' }, deps), /autenticado/)
  await assert.rejects(() => importInitialChannel({ ownerId: 'u1', handle: 'a' }, deps), /Handle inválido/)
  await assert.rejects(() => importInitialChannel({ ownerId: 'u1', handle: 'abc', channelId: id }, deps), /exatamente/)
  assert.deepEqual(calls, [])
})

test('falha na importação é propagada sem indicar sucesso', async () => {
  const { calls, deps } = fixture()
  deps.fetchUploads = async () => { throw new Error('cota indisponível') }
  await assert.rejects(() => importInitialChannel({ ownerId: 'u1', channelId: id }, deps), /cota indisponível/)
  assert.equal(calls.includes('save'), false)
})
