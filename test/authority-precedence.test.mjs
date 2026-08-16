import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { resolveAuthorityConflict } from '../lib/authority-precedence.mjs'

const root = path.resolve(import.meta.dirname, '..')
const contract = JSON.parse(fs.readFileSync(path.join(root, 'authority-precedence.json'), 'utf8'))

test('authority-precedence.json is a policy contract, not an evidence-gated pattern', () => {
  assert.equal(contract.rule, 'most_restrictive_wins')
  assert.equal(contract.authority, 'none')
  assert.equal(contract.corpus_hit_cannot_override_native_refusal, true)
  assert.equal(contract.native_permissiveness_cannot_override_corpus_hit, true)
  assert.ok(!fs.existsSync(path.join(root, 'fables', 'AF-authority-precedence.md')), 'this is deliberately not a fable')
})

test('a native refusal wins over a corpus hit, not the reverse', () => {
  const result = resolveAuthorityConflict('refusal', 'hit')
  assert.equal(result.outcome, 'blocked')
  assert.equal(result.governing_signal, 'native')
})

test('a corpus hit wins over native permissiveness (native=none)', () => {
  const result = resolveAuthorityConflict('none', 'hit')
  assert.equal(result.outcome, 'blocked')
  assert.equal(result.governing_signal, 'corpus')
})

test('native caution alone still blocks even when the corpus is silent', () => {
  const result = resolveAuthorityConflict('caution', 'none')
  assert.equal(result.outcome, 'blocked')
  assert.equal(result.governing_signal, 'native')
})

test('both signals clear only proceeds when both are actually clear', () => {
  const result = resolveAuthorityConflict('none', 'none')
  assert.equal(result.outcome, 'proceed')
  assert.equal(result.governing_signal, 'none')
})

test('a corpus hit cannot be talked down by anything less than native refusal', () => {
  const result = resolveAuthorityConflict('caution', 'hit')
  assert.equal(result.outcome, 'blocked')
  // refusal > hit > caution: hit is still the deciding signal here since native is only caution
  assert.equal(result.governing_signal, 'corpus')
})
