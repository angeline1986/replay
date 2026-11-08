import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('seguir vídeo não solicita escolha manual nem confirmação', () => {
  const source = readFileSync(new URL('../../src/app/story-actions.ts', import.meta.url), 'utf8')
  const follow = source.split('async function follow(video: Video)')[1]
    ?.split('async function rename(')[0]
  assert.ok(follow, 'Função follow não encontrada')
  assert.doesNotMatch(follow, /\b(?:prompt|confirm)\s*\(/)
  assert.match(follow, /const name = video\.title\.trim\(\)/)
  assert.match(follow, /followStory\(client\(\), hooks\.userId\(\), video\.id, name, aliases\)/)
  assert.match(follow, /if \(result\.existing\) await attachStoryVideo\(client\(\), result\.id, video\.id\)/)
  assert.match(follow, /scanStoryNow\(client\(\), result\.id\)/)
})
