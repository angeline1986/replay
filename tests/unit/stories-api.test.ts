import assert from 'node:assert/strict'
import test from 'node:test'
import { storyInput } from '../../src/shared/stories-api.ts'

test('nome corrigido e aliases preservam chave estável e sem duplicatas', () => {
  assert.deepEqual(storyInput('  Lábios   Afiados como uma Faca  ',
    ['Frost & Greyson', 'Frost & Greyson', ' Outra Obra ']), {
    name: 'Lábios Afiados como uma Faca',
    canonical_key: 'labios afiados como uma faca',
    aliases: ['Frost & Greyson', 'Outra Obra']
  })
})

test('nome genérico e excesso de aliases são rejeitados', () => {
  assert.throws(() => storyInput('Manhwa recap parte 2', []), /distintivo/)
  assert.throws(() => storyInput('Obra Distinta', Array.from({ length: 11 }, (_, i) => `Nome ${i}`)),
    /10 aliases/)
})
