import { execFile } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { promisify } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import { makeAuthClient } from './auth.ts'
import { affectedChannels, changeChannels, changeOne, listChannels } from './channels.ts'
import { publicConfig } from './config.ts'
import { dispatchManual, githubLogin, listRuns, runDetail, type Run } from './github.ts'

const open = promisify(execFile)
const dashboard = 'https://angeline1986.github.io/replay/'
const io = createInterface({ input: process.stdin, output: process.stdout })
let client: SupabaseClient | null = null

async function question(text: string): Promise<string> {
  return (await io.question(text)).trim()
}

async function channelsClient(): Promise<SupabaseClient> {
  client ??= await makeAuthClient()
  return client
}

function plain(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').slice(0, 120)
}

function safeMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : 'Operação não concluída.'
  return plain(value.replace(/https?:\/\/\S+|\b(?:sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9._-]+/g,
    '[dado protegido]'))
}

function showChannels(channels: Awaited<ReturnType<typeof listChannels>>): void {
  if (!channels.length) { console.log('Nenhum canal cadastrado.'); return }
  channels.forEach((channel, index) => {
    console.log(`${index + 1}. ${plain(channel.name)} — ${channel.is_active ? 'ativo' : 'pausado'} ` +
      `(${channel.youtube_channel_id})`)
  })
  console.log(`Total: ${channels.length}; ativos: ${channels.filter((item) => item.is_active).length}.`)
}

function localTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'indisponível'
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

async function showRun(run: Run): Promise<Awaited<ReturnType<typeof runDetail>>> {
  const detail = await runDetail(run)
  console.log(`Run ${run.databaseId} · ${run.event === 'schedule' ? 'automática' : 'manual'} · ${detail.state}`)
  console.log(`Solicitado: ${localTime(run.createdAt)}; iniciado: ${localTime(detail.startedAt)}.`)
  if (run.event === 'schedule') console.log('Horário programado: 17:00 (America/Sao_Paulo).')
  console.log(detail.summary ?? 'Contagem de vídeos e cota indisponíveis ou sem coleta.')
  console.log(run.url)
  return detail
}

async function lastCollection(): Promise<void> {
  const runs = await listRuns(20)
  if (!runs.length) { console.log('Nenhuma execução encontrada.'); return }
  console.log('Última execução do monitor:')
  const latest = await showRun(runs[0])
  if (latest.attempted && (latest.state === 'concluída' || latest.state === 'falhou')) return
  for (const run of runs.slice(1)) {
    const detail = await runDetail(run)
    if (detail.attempted && (detail.state === 'concluída' || detail.state === 'falhou')) {
      console.log('Última execução que chegou à etapa de coleta:')
      await showRun(run)
      return
    }
  }
  console.log('Nenhuma coleta confirmada entre as 20 execuções recentes.')
}

async function toggleChannel(): Promise<void> {
  const db = await channelsClient()
  const channels = await listChannels(db)
  showChannels(channels)
  if (!channels.length) return
  const index = Number(await question('Número do canal (0 cancela): '))
  if (index === 0) return
  if (!Number.isInteger(index) || index < 1 || index > channels.length) {
    console.log('Número inválido.'); return
  }
  const channel = channels[index - 1]
  const action = channel.is_active ? 'pausar' : 'ativar'
  if ((await question(`Digite SIM para ${action} ${plain(channel.name)}: `)) !== 'SIM') {
    console.log('Operação cancelada.'); return
  }
  await changeOne(db, channel)
  console.log(`Canal ${plain(channel.name)} ${channel.is_active ? 'pausado' : 'ativado'}.`)
}

async function bulk(active: boolean): Promise<void> {
  const db = await channelsClient()
  const targets = affectedChannels(await listChannels(db), active)
  const action = active ? 'ativar' : 'pausar'
  if (!targets.length) { console.log(`Nenhum canal precisa ser ${active ? 'ativado' : 'pausado'}.`); return }
  const answer = await question(`Confirme ${action} ${targets.length} canal(is). Digite SIM ${targets.length}: `)
  if (answer !== `SIM ${targets.length}`) { console.log('Operação cancelada.'); return }
  const changed = await changeChannels(db, targets, active)
  console.log(`${changed} canal(is) ${active ? 'ativados' : 'pausados'}.`)
}

async function health(): Promise<void> {
  console.log(`Dashboard: ${dashboard}`)
  console.log('Agendamento da main: 17:00, America/Sao_Paulo.')
  try { await publicConfig(); console.log('Configuração pública Supabase: pronta.') }
  catch { console.log('Configuração pública Supabase: ausente ou inválida.') }
  try { console.log(`GitHub CLI: autenticado como ${await githubLogin()}.`) }
  catch { console.log('GitHub CLI: autenticação ou conexão indisponível.') }
  try {
    const runs = await listRuns(1)
    if (runs.length) await showRun(runs[0])
    else console.log('Workflow: sem execuções recentes.')
  } catch { console.log('Workflow: consulta indisponível.') }
  if (client) {
    try { showChannels(await listChannels(client)) }
    catch { console.log('Canais: sessão não disponível.') }
  } else console.log('Canais: escolha a opção 3 para autenticar e consultar.')
}

const menu = `\nRePlay — central de controle
1. Atualizar vídeos agora
2. Consultar última coleta
3. Listar canais monitorados
4. Ativar/pausar canal
5. Ativar todos os canais
6. Pausar todos os canais
7. Verificar estado do RePlay
8. Abrir dashboard no navegador
9. Sair\n`

try {
  while (true) {
    console.log(menu)
    const choice = await question('Escolha uma opção: ')
    try {
      if (choice === '1') {
        if ((await question('Solicitar a coleta manual de hoje? Digite SIM: ')) === 'SIM') {
          await dispatchManual()
          console.log('Solicitação enviada. A coleta ainda não está confirmada; consulte a opção 2.')
        } else console.log('Operação cancelada.')
      } else if (choice === '2') await lastCollection()
      else if (choice === '3') showChannels(await listChannels(await channelsClient()))
      else if (choice === '4') await toggleChannel()
      else if (choice === '5') await bulk(true)
      else if (choice === '6') await bulk(false)
      else if (choice === '7') await health()
      else if (choice === '8') {
        try { await open('open', [dashboard]); console.log('Dashboard aberto no navegador.') }
        catch { throw new Error('Não foi possível abrir o navegador.') }
      } else if (choice === '9' || !choice && !process.stdin.isTTY) break
      else console.log('Opção inválida.')
    } catch (error) {
      console.error(safeMessage(error))
    }
  }
} finally { io.close() }
