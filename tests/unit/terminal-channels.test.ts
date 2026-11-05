import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { affectedChannels, changeChannels, type MonitoredChannel } from '../../cli/channels.ts'
import { memoryStorage, requireOwner } from '../../cli/auth.ts'

const channels: MonitoredChannel[] = [
  { id: 'a', name: 'A', youtube_channel_id: 'UCA', is_active: true },
  { id: 'b', name: 'B', youtube_channel_id: 'UCB', is_active: false }
]

function fakeClient(role = 'owner', rows = channels) {
  const changes: string[] = []
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test' } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null })
    },
    from(table: string) {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { user_id: 'owner-id', role }, error: null
        }) }) })
      }
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
        update: (value: { is_active: boolean }) => ({
          eq: () => ({ eq: () => ({ in: (_field: string, ids: string[]) => ({
            select: async () => {
              changes.push(...ids)
              return { data: ids.map((id) => ({ id, active: value.is_active })), error: null }
            }
          }) }) })
        })
      }
    }
  }
  return { client: client as unknown as SupabaseClient, changes }
}

test('sessão em memória não grava no disco', () => {
  const storage = memoryStorage()
  storage.setItem('session', 'test')
  assert.equal(storage.getItem('session'), 'test')
  storage.removeItem('session')
  assert.equal(storage.getItem('session'), null)
})

test('apenas perfil owner é aceito antes de ler ou escrever canais', async () => {
  assert.equal(await requireOwner(fakeClient().client), 'owner-id')
  await assert.rejects(requireOwner(fakeClient('admin').client), /owner/)
})

test('alteração em massa só inclui canais confirmados e recusa lista desatualizada', async () => {
  const { client, changes } = fakeClient()
  const targets = affectedChannels(channels, true)
  assert.deepEqual(targets.map((item) => item.id), ['b'])
  assert.equal(await changeChannels(client, targets, true), 1)
  assert.deepEqual(changes, ['b'])
  await assert.rejects(changeChannels(client, channels, true), /mudou/)
  assert.deepEqual(changes, ['b'])
})
