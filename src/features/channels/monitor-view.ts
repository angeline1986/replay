import { button, element, notice } from '../../shared/dom.ts'
import type { MonitorSnapshot } from '../../shared/monitor-api.ts'

function inSaoPaulo(value: string | null): string {
  if (!value) return 'Ainda não começou'
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function monitorView(snapshot: MonitorSnapshot | null, loading: boolean,
  error: string, onCollect: () => void, demo: boolean): HTMLElement {
  const card = element('section', 'monitor-card')
  const header = element('div', 'monitor-head')
  header.append(element('h2', '', 'Coleta de vídeos'))
  const collect = button('Atualizar vídeos', onCollect, 'primary')
  collect.disabled = demo || loading || !snapshot?.manualAvailable
  header.append(collect)
  card.append(header)
  card.append(element('p', 'muted small',
    `Automática: diariamente às 17:00 (America/Sao_Paulo). Manual: ${snapshot?.manualReason ?? 'Verificando disponibilidade…'}`))
  if (error) card.append(notice(error, 'error'))
  if (loading && !snapshot) card.append(notice('Consultando última coleta…'))
  if (demo) card.append(notice('A coleta está indisponível no modo demonstração.'))
  const run = snapshot?.run
  if (!run) {
    if (!loading && !error) card.append(notice('Nenhuma execução registrada.'))
    return card
  }
  card.append(element('p', 'monitor-state', `${run.trigger} · ${run.state}`))
  const details = element('div', 'monitor-details')
  details.append(
    element('span', '', `Programado: ${run.scheduledAt ?? 'Sob demanda'}`),
    element('span', '', `Início efetivo: ${inSaoPaulo(run.startedAt)}`),
    element('span', '', `Vídeos processados: ${run.videosProcessed ?? 'Ainda indisponível'}`),
    element('span', '', `Falhas: ${run.failures ?? 'Ainda indisponível'}`),
    element('span', '', `Cota estimada: ${run.quotaUnits ?? 'Ainda indisponível'}`)
  )
  if (run.finishedAt) details.append(element('span', '', `Fim: ${inSaoPaulo(run.finishedAt)}`))
  card.append(details)
  if (run.errors.length) {
    const errors = element('ul', 'monitor-errors')
    for (const message of run.errors) errors.append(element('li', '', message))
    card.append(errors)
  }
  return card
}
