import assert from 'node:assert/strict'
import test from 'node:test'
import { findExistingChapters, parseStoryPosition, proposeStoryMatch, suggestStoryName,
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
  assert.deepEqual(parseStoryPosition('|31-38| Ele era chamado de INÚTIL'),
    { kind: 'part', first: 31, last: 38, season: null })
  assert.deepEqual(parseStoryPosition('|39| Ele era chamado de INÚTIL'),
    { kind: 'part', first: 39, last: 39, season: null })
  assert.deepEqual(parseStoryPosition('PARTE 01 - 02'),
    { kind: 'part', first: 1, last: 2, season: null })
  assert.deepEqual(parseStoryPosition('TGCF AD S4 EP11 Farewell Scene'),
    { kind: 'episode', first: 11, last: 11, season: 4 })
  assert.equal(parseStoryPosition('Capítulo 0'), null)
  assert.deepEqual(parseStoryPosition('O Cão do Império #parte03'),
    { kind: 'part', first: 3, last: 3, season: null })
})

test('encontra capítulos já cadastrados mesmo quando o título muda na sequência', () => {
  const title = '|31-38| Ele era Chamado de INÚTIL da Família, mas Um Dia o Demônio Celestial DESPERTOU no seu Corpo!'
  const pattern: TrackedPattern = { title, aliases: [], channelIds: ['geek'],
    lastPosition: parseStoryPosition(title), latestPublishedAt: '2025-09-06T21:45:01Z' }
  const titles = [
    '|39| Ele era Chamado de INÚTIL da Família, mas Um Dia o Demônio Celestial DESPERTOU no seu Corpo!',
    '|40| Ele era Chamado de INÚTIL da Família, mas Um Dia o Demônio Celestial DESPERTOU no seu Corpo!',
    '|41| Ele era Chamado de INÚTIL da Família, mas Um Dia o Demônio Celestial DESPERTOU no seu Corpo!',
    '|42| O Demônio Celestial DESPERTOU no Corpo do INÚTIL da Família Dimitri! - ManhwaRecap',
    '|43| O Demônio Celestial DESPERTOU no Corpo do INÚTIL da Família Dimitri! - ManhwaRecap',
    '|44| O Demônio Celestial DESPERTOU em Outro Mundo, mas escolheu não ter uma vida NORMAL! ManhwaRecap',
    '|45| O Demônio Celestial DESPERTOU em Outro Mundo, mas escolheu não ter uma vida NORMAL! ManhwaRecap',
    '|46| O Demônio Celestial DESPERTOU no Corpo do INÚTIL da Família Dimitri! - ManhwaRecap',
    '|47| O Demônio Celestial DESPERTOU no Corpo do INÚTIL da Família Dimitri! - ManhwaRecap',
    '|48| Ele era Chamado de INÚTIL da Família, mas Um Dia o Demônio Celestial DESPERTOU no seu Corpo!'
  ]
  const videos = titles.map((item, index) => ({ id: `part-${index + 39}`, title: item,
    channelId: 'geek', publishedAt: new Date(Date.parse(pattern.latestPublishedAt) +
      (index + 1) * 86400000).toISOString() }))
  const found = findExistingChapters(pattern, [...videos].reverse(), new Set())
  assert.equal(found.length, 10)
  assert.equal(found.at(-1)?.match.position?.last, 48)
  const continued = findExistingChapters(pattern, videos, new Set(['part-39']), new Set(['part-39']))
  assert.equal(continued.length, 9)
  assert.equal(continued[0].id, 'part-40')
  assert.equal(proposeStoryMatch(pattern, { ...videos[0], channelId: 'other',
    title: '|39| Outro príncipe conquistou um reino' }), null)
})

test('semelhança aproximada entre canais não cria candidato', () => {
  const pattern = { ...story, title: 'Frost and Greyson' }
  assert.equal(proposeStoryMatch(pattern,
    video('Frost & Greyson - Parte 4', 'canal-b')), null)
})
