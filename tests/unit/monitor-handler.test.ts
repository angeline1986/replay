import assert from 'node:assert/strict'
import test from 'node:test'
import { handleMonitorRequest, HttpError, type Services } from '../../supabase/functions/monitor-control/handler.ts'
import type { GithubClient } from '../../supabase/functions/monitor-control/github-app.ts'
import type { WorkflowRun } from '../../supabase/functions/monitor-control/status.ts'

const today = '2026-11-05T15:00:00Z'
const previous: WorkflowRun = { id: 4, event: 'schedule', created_at: today,
  status: 'completed', conclusion: 'success', head_branch: 'main',
  path: '.github/workflows/monitor.yml' }

function setup(runs: WorkflowRun[] = [previous], active = 2) {
  let dispatches = 0
  let changes = 0
  let authorized = 0
  const github = {
    listRuns: async () => ({ workflow_runs: runs }),
    run: async (id: number) => runs.find((item) => item.id === id)!,
    jobs: async () => ({ jobs: [] }),
    jobLog: async () => '',
    dispatch: async () => { dispatches++; return { workflow_run_id: 20 } }
  } as GithubClient
  const services: Services = {
    now: () => today, github: () => github,
    owner: async () => {
      authorized++
      return { userId: 'owner', activeCount: async () => active,
        changeChannels: async (_active, _id, count) => { changes++; return count ?? 1 } }
    }
  }
  const call = (body: unknown, authorization = 'Bearer abc.def.ghi') =>
    handleMonitorRequest(new Request('https://example.com/monitor-control', {
      method: 'POST', headers: { authorization, origin: 'https://angeline1986.github.io' },
      body: JSON.stringify(body)
    }), services)
  return { call, services, stats: () => ({ dispatches, changes, authorized }) }
}

test('somente sessão válida e owner podem chegar à API GitHub', async () => {
  const context = setup()
  assert.equal((await context.call({ action: 'dispatch' }, '')).status, 401)
  assert.equal(context.stats().authorized, 0)
  context.services.owner = async () => { throw new HttpError(403, 'Acesso restrito ao perfil owner.') }
  const response = await context.call({ action: 'dispatch' })
  assert.equal(response.status, 403)
  assert.equal(context.stats().dispatches, 0)
})

test('solicitação repetida ou sem canal ativo não dispara o workflow', async () => {
  const repeated = setup([{ ...previous, id: 7, event: 'workflow_dispatch' }])
  assert.equal((await repeated.call({ action: 'dispatch' })).status, 409)
  assert.equal(repeated.stats().dispatches, 0)
  const paused = setup([], 0)
  assert.equal((await paused.call({ action: 'dispatch' })).status, 409)
  assert.equal(paused.stats().dispatches, 0)
})

test('dispatch retorna ID rastreável e status não confunde sucesso vazio', async () => {
  const context = setup()
  const dispatched = await context.call({ action: 'dispatch' })
  assert.equal(dispatched.status, 202)
  assert.equal((await dispatched.json()).runId, 20)
  assert.equal(context.stats().dispatches, 1)
  const status = await context.call({ action: 'status' })
  assert.equal(status.status, 200)
  const body = await status.json()
  assert.equal(body.run.state, 'falhou')
  assert.equal(body.manualAvailable, true)
})

test('mudança em massa exige contagem e autorização prévias', async () => {
  const context = setup()
  assert.equal((await context.call({ action: 'channels', active: true })).status, 400)
  assert.equal(context.stats().changes, 0)
  const response = await context.call({ action: 'channels', active: true, expectedCount: 60 })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).changed, 60)
  assert.equal(context.stats().changes, 1)
})

test('JSON inválido, origem externa e execução alheia são rejeitados', async () => {
  const context = setup()
  const badJson = await handleMonitorRequest(new Request('https://example.com/monitor-control', {
    method: 'POST', headers: { authorization: 'Bearer abc.def.ghi' }, body: '{'
  }), context.services)
  assert.equal(badJson.status, 400)
  const external = await handleMonitorRequest(new Request('https://example.com/monitor-control', {
    method: 'POST', headers: { authorization: 'Bearer abc.def.ghi', origin: 'https://evil.example' },
    body: '{"action":"dispatch"}'
  }), context.services)
  assert.equal(external.status, 403)
  const original = context.services.github()
  context.services.github = () => ({
    ...original,
    run: async () => ({ ...previous, path: '.github/workflows/other.yml' })
  }) as GithubClient
  assert.equal((await context.call({ action: 'status', runId: 4 })).status, 404)
})
