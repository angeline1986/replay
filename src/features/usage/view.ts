import { button, element, notice } from '../../shared/dom.ts'
import type { UsageSummary } from './data.ts'

const dailyLimit = 10_000

function metric(label: string, value: string): HTMLElement {
  const card = element('div', 'usage-metric')
  card.append(element('span', '', label), element('strong', '', value))
  return card
}

function details(summary: UsageSummary): HTMLElement {
  const content = element('div', 'usage-details')
  const estimate = summary.lower === summary.upper ? String(summary.lower)
    : `${summary.lower}–${summary.upper}`
  const cards = element('div', 'usage-metrics')
  cards.append(metric('Unidades estimadas', estimate),
    metric('Verificações de canais', String(summary.channels)),
    metric('Tentativas de cadastro', String(summary.attempts)))
  const quota = element('div', 'usage-quota')
  const quotaHead = element('div', 'usage-quota-head')
  quotaHead.append(element('strong', '', 'Limite diário'),
    element('span', '', `${dailyLimit.toLocaleString('pt-BR')} unidades`))
  const progress = element('progress')
  progress.max = dailyLimit
  progress.value = Math.min(summary.upper, dailyLimit)
  progress.setAttribute('aria-label', 'Parcela estimada da cota diária')
  quota.append(quotaHead, progress)
  const day = summary.day.split('-').reverse().join('/')
  const last = summary.lastCheck ? new Date(summary.lastCheck).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'
  }) : 'Nenhuma coleta registrada'
  const info = element('p', 'usage-note',
    `Dia da cota: ${day} (horário do Pacífico). Última coleta registrada: ${last}.`)
  const caveat = element('p', 'usage-note',
    'Estimativa das coletas e cadastros registrados pelo RePlay. Buscas avulsas e outros usos da chave não entram neste cálculo; o total exato fica no Google Cloud.')
  const cloud = element('a', 'usage-cloud', 'Ver total exato no Google Cloud ↗')
  cloud.href = 'https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas'
  cloud.target = '_blank'
  cloud.rel = 'noopener noreferrer'
  content.append(cards, quota, info, caveat, cloud)
  return content
}

export function usageView(load?: () => Promise<UsageSummary>): HTMLElement {
  const root = element('section', 'content usage-page')
  const heading = element('div', 'favorites-toolbar')
  const title = element('div', 'favorite-page-title')
  title.append(element('h1', '', 'Consumo do YouTube'))
  heading.append(title)
  const body = element('div', 'usage-body')
  if (!load) body.append(notice('Consumo indisponível no modo demonstração.'))
  else {
    const reload = button('Atualizar', () => { void refresh() }, 'ghost usage-refresh')
    heading.append(reload)
    async function refresh(): Promise<void> {
      reload.disabled = true
      body.replaceChildren(notice('Carregando consumo…'))
      try { body.replaceChildren(details(await load!())) }
      catch (error) { body.replaceChildren(notice(error instanceof Error ? error.message : 'Consumo indisponível.', 'error')) }
      finally { reload.disabled = false }
    }
    void refresh()
  }
  root.append(heading, body)
  return root
}
