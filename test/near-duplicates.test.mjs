import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { findNearDuplicates, undocumentedNearDuplicates } from '../lib/near-duplicates.mjs'

const root = path.resolve(import.meta.dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const overlaps = JSON.parse(fs.readFileSync(path.join(root, 'overlaps.json'), 'utf8'))

test('two entries with near-identical searchable text score high similarity', () => {
  const a = { id: 'AF-TEST-A', title: 'x', failure_mode: 'y', affected_versions: '', fixed_in: '', stacks: [], behavioral_indicators: ['fetch returned an empty body treated as fully read'], exact_signatures: [] }
  const b = { id: 'AF-TEST-B', title: 'x', failure_mode: 'y', affected_versions: '', fixed_in: '', stacks: [], behavioral_indicators: ['fetch returned an empty body treated as fully read'], exact_signatures: [] }
  const pairs = findNearDuplicates([a, b], 0.5)
  assert.equal(pairs.length, 1)
  assert.ok(pairs[0].similarity > 0.7, `expected high similarity, got ${pairs[0].similarity}`)
})

test('two entries with disjoint vocabulary score zero similarity', () => {
  const a = { id: 'AF-TEST-A', title: 'alpha', failure_mode: 'beta', affected_versions: '', fixed_in: '', stacks: [], behavioral_indicators: ['gamma delta epsilon'], exact_signatures: [] }
  const b = { id: 'AF-TEST-B', title: 'zeta', failure_mode: 'eta', affected_versions: '', fixed_in: '', stacks: [], behavioral_indicators: ['theta iota kappa'], exact_signatures: [] }
  const pairs = findNearDuplicates([a, b], 0.01)
  assert.equal(pairs.length, 0)
})

test('the real corpus has zero severe (>=0.15) undocumented near-duplicate pairs', () => {
  const severe = undocumentedNearDuplicates(index.entries, overlaps.pairs, 0.15)
  assert.deepEqual(severe, [], `undocumented severe overlap: ${JSON.stringify(severe)}`)
})

test('every documented overlaps.json pair actually exists in the corpus', () => {
  const known = new Set(index.entries.map(entry => entry.id))
  for (const pair of overlaps.pairs) for (const id of pair.ids) assert.ok(known.has(id), `overlaps.json references unknown ${id}`)
})
