import assert from 'node:assert/strict'
import test from 'node:test'
import { parseStoryPosition, proposeStoryMatch, suggestStoryName,
  type CandidateVideo, type TrackedPattern } from '../../src/shared/story-match.ts'

const story: TrackedPattern = {
  title: 'Lábios Afiados como uma Faca', aliases: [], channelIds: ['canal-a'],
  lastPosition: { kind: 'part', first: 3, last: 3, season: null },
  latestPublishedAt: '2026-11-04T10:00:00Z'
}
function video(title: string, channelId = 'canal-a'): CandidateVideo {
  return { title, channelId, publishedAt: '2026-11-05T10:00:00Z' }
}

test('detecta a parte seguinte com nome da obra e canal iguais', () => {
  const result = proposeStoryMatch(story, video('💜 Lábios Afiados como uma Faca – Parte 4'))
  assert.equal(result?.confidence, 'alta')
  assert.equal(result?.position?.last, 4)
  assert.match(result?.reason ?? '', /numeração seguinte/)
})

test('detecta títulos de chamada diferentes quando mantêm o nome da obra', () => {
  const pattern = { ...story, title: 'Frost & Greyson', lastPosition: {
    kind: 'part' as const, first: 7, last: 7, season: null
  } }
  const result = proposeStoryMatch(pattern,
    video('Part 8: Shopping to Do | Frost & Greyson | #shorts #bl'))
  assert.equal(result?.confidence, 'alta')
  assert.equal(suggestStoryName('Part 8: Shopping to Do | Frost & Greyson | #shorts'), 'Frost & Greyson')
})

test('mesma obra em outro canal vira candidata de confiança média', () => {
  const result = proposeStoryMatch(story,
    video('Lábios Afiados como uma Faca | PARTE 04 - Recap', 'canal-b'))
  assert.equal(result?.confidence, 'média')
  assert.match(result?.reason ?? '', /outro canal/)
})

test('recusa repetição e parte anterior mesmo com nome igual', () => {
  assert.equal(proposeStoryMatch(story, video('Lábios Afiados como uma Faca - Parte 3')), null)
  assert.equal(proposeStoryMatch(story, video('Lábios Afiados como uma Faca - Parte 2')), null)
})

test('recusa falso positivo baseado apenas em termos genéricos ou mesmo canal', () => {
  const generic = { ...story, title: 'Manhwa Recap Parte 1' }
  assert.equal(proposeStoryMatch(generic, video('Manhwa Recap Parte 2')), null)
  assert.equal(proposeStoryMatch(story, video('(PARTE 04) Ela Era uma Duquesa, Agora é uma Cativa!')), null)
})

test('aceita faixa de partes e episódio com temporada, sem confundir formatos', () => {
  assert.deepEqual(parseStoryPosition('PARTE 01 - 02'),
    { kind: 'part', first: 1, last: 2, season: null })
  assert.deepEqual(parseStoryPosition('TGCF AD S4 EP11 Farewell Scene'),
    { kind: 'episode', first: 11, last: 11, season: 4 })
  assert.equal(parseStoryPosition('Capítulo 0'), null)
  assert.deepEqual(parseStoryPosition('O Cão do Império #parte03'),
    { kind: 'part', first: 3, last: 3, season: null })
})

test('semelhança aproximada entre canais não cria candidato', () => {
  const pattern = { ...story, title: 'Frost and Greyson' }
  assert.equal(proposeStoryMatch(pattern,
    video('Frost & Greyson - Parte 4', 'canal-b')), null)
})
