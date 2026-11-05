import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { confirmBulk } from '../../src/features/channels/bulk.ts'
import { monitorView } from '../../src/features/channels/monitor-view.ts'
import { demoChannels } from '../../src/shared/demo.ts'

test('confirma a quantidade real antes de ativar ou pausar em massa', () => {
  const channels = structuredClone(demoChannels)
  channels[0].is_active = true
  channels[1].is_active = false
  let prompt = ''
  const ask = (message: string) => { prompt = message; return true }
  assert.equal(confirmBulk(channels, true, ask), 1)
  assert.equal(prompt, 'Ativar 1 canal?')
  assert.equal(confirmBulk(channels, false, ask), 1)
  assert.equal(prompt, 'Pausar 1 canal?')
  assert.equal(confirmBulk(channels, true, () => false), null)
  channels[1].is_active = true
  assert.equal(confirmBulk(channels, true, ask), null)
})

test('portal mostra status, horários e contagem sem interpretar erro como HTML', () => {
  const original = globalThis.document
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.document = dom.window.document
  try {
    let clicks = 0
    const card = monitorView({
      run: { id: 1, state: 'concluída', trigger: 'automática',
        scheduledAt: '17:00 America/Sao_Paulo', startedAt: '2026-11-05T00:41:36Z',
        finishedAt: '2026-11-05T00:41:54Z', videosProcessed: 100,
        failures: 1, quotaUnits: 5, errors: ['<script>erro</script>'] },
      manualAvailable: true, manualReason: 'Coleta manual disponível.', activeChannels: 2
    }, false, '', () => { clicks++ }, false)
    assert.match(card.textContent ?? '', /Programado: 17:00/)
    assert.match(card.textContent ?? '', /Início efetivo: 04\/11\/2026/)
    assert.match(card.textContent ?? '', /Vídeos processados: 100/)
    assert.equal(card.querySelector('script'), null)
    card.querySelector('button')!.click()
    assert.equal(clicks, 1)
    const blocked = monitorView({ run: null, manualAvailable: false,
      manualReason: 'Coleta manual do dia já solicitada.', activeChannels: 2 },
    false, '', () => { clicks++ }, false)
    blocked.querySelector('button')!.click()
    assert.equal(clicks, 1)
  } finally { globalThis.document = original; dom.window.close() }
})
