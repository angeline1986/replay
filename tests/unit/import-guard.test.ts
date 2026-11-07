import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseImportInput } from '../../supabase/functions/import-channel/input.ts'

const sql = readFileSync('docs/architecture/replay-import-guard.proposal.sql', 'utf8')
const edge = readFileSync('supabase/functions/import-channel/index.ts', 'utf8')
const worker = readFileSync('supabase/functions/import-channel/import-one.ts', 'utf8')

test('aceita um unico identificador valido', () => {
  assert.deepEqual(parseImportInput({ handle: 'MestredoKimchi' }), { handle: 'MestredoKimchi', channelId: undefined })
  assert.equal(parseImportInput({ channelId: `UC${'a'.repeat(22)}` }).channelId, `UC${'a'.repeat(22)}`)
})
test('recusa payloads malformados, campos extras e valores nao-textuais', () => {
  for (const value of [null, [], {}, { handle: '' }, { handle: 123 },
    { handle: '@bad' }, { handle: 'valid', channelId: `UC${'a'.repeat(22)}` },
    { handle: 'valid', ownerId: 'outro' }, { channelId: 'youtube.com' }]) {
    assert.throws(() => parseImportInput(value))
  }
})
test('reserva SQL nao libera running automaticamente apos 120 segundos', () => {
  assert.match(sql, /status = 'running'\) then/)
  assert.doesNotMatch(sql, /created_at > now\(\) - interval '120 seconds'/)
  assert.match(sql, /revoke all on function public\.reserve_replay_import/)
  assert.match(sql, /grant execute on function public\.reserve_replay_import\(uuid,text\) to service_role/)
})
test('resultado HTTP depende de gravacao confirmada do status', () => {
  assert.match(edge, /\.update\(\{ status: 'done' \}\)/)
  assert.match(edge, /\.update\(\{ status: 'failed' \}\)/)
  assert.match(edge, /recorded\.error \|\| !recorded\.data/)
})
test('retry de canal incompleto nao reativa canal existente', () => {
  assert.match(worker, /const saved = existing \?\? checked/)
})
