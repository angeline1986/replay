import assert from 'node:assert/strict'
import test from 'node:test'
import { createPrivateKey, createPublicKey, verify } from 'node:crypto'
import { appJwt, githubClient, type AppCredentials } from '../../supabase/functions/monitor-control/github-app.ts'

async function credentials(): Promise<AppCredentials> {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'])
  const privateKey = createPrivateKey({ key: Buffer.from(
    await crypto.subtle.exportKey('pkcs8', keys.privateKey)), format: 'der', type: 'pkcs8' })
    .export({ format: 'pem', type: 'pkcs1' }).toString()
  return { appId: '123', installationId: '456',
    privateKey }
}

test('JWT do GitHub App é assinado e não contém a chave privada', async () => {
  const config = await credentials()
  const token = await appJwt(config, Date.parse('2026-11-05T15:00:00Z'))
  assert.equal(token.split('.').length, 3)
  assert.equal(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).iss, '123')
  const [header, payload, signature] = token.split('.')
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`),
    createPublicKey(config.privateKey), Buffer.from(signature, 'base64url')), true)
  assert.equal(token.includes('PRIVATE KEY'), false)
})

test('cliente limita o token ao repositório e despacha na main com ID', async () => {
  const config = await credentials()
  const urls: string[] = []
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input)
    urls.push(url)
    if (url.endsWith('/access_tokens')) {
      assert.equal(JSON.parse(String(init?.body)).repositories[0], 'replay')
      assert.equal(JSON.parse(String(init?.body)).permissions.actions, 'write')
      return Response.json({ token: 'installation-token' })
    }
    if (url.endsWith('/dispatches')) {
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer installation-token')
      assert.deepEqual(JSON.parse(String(init?.body)), { ref: 'main', return_run_details: true })
      return Response.json({ workflow_run_id: 42 })
    }
    if (url.endsWith('/jobs/7/logs')) {
      return new Response(null, { status: 302,
        headers: { location: 'https://logs.example/collector' } })
    }
    assert.equal(url, 'https://logs.example/collector')
    assert.equal(new Headers(init?.headers).has('authorization'), false)
    return new Response('Resultado: sucesso; vídeos=1;', { status: 200 })
  }) as typeof fetch
  const github = githubClient(config, fetcher)
  assert.equal((await github.dispatch()).workflow_run_id, 42)
  assert.match(await github.jobLog(7), /Resultado/)
  assert.equal(urls.filter((url) => url.endsWith('/access_tokens')).length, 1)
  assert.equal(urls.some((url) => url.includes('installation-token')), false)
})

test('falha da API não inclui resposta nem credencial', async () => {
  const config = await credentials()
  const failed = (async () => new Response('secret body', { status: 403 })) as typeof fetch
  await assert.rejects(githubClient(config, failed).dispatch(), (error: Error) => {
    assert.match(error.message, /HTTP 403/)
    assert.equal(error.message.includes('secret body'), false)
    return true
  })
})
