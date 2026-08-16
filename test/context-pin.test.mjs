import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { pin, isPinned, checkPinsSurvived } from '../lib/context-pin.mjs'

const root = path.resolve(import.meta.dirname, '..')

test('context-pin.schema.json is policy, not an evidence-gated pattern', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'context-pin.schema.json'), 'utf8'))
  assert.deepEqual(schema.required, ['_af_pin', '_af_kind', '_af_ttl'])
  assert.ok(!fs.existsSync(path.join(root, 'fables', 'AF-0045.md')), 'no incident backs this; it is deliberately not a fable')
})

test('pin() attaches the marker fields without mutating the original object', () => {
  const receipt = { id: 'r1', match: 'hit' }
  const pinned = pin(receipt, 'receipt')
  assert.equal(isPinned(pinned), true)
  assert.equal(pinned._af_kind, 'receipt')
  assert.equal(pinned._af_ttl, 'session')
  assert.equal(isPinned(receipt), false, 'original object must be untouched')
})

test('pin() rejects an unknown kind or ttl rather than silently accepting it', () => {
  assert.throws(() => pin({}, 'not_a_real_kind'), /unknown pin kind/)
  assert.throws(() => pin({ id: 'x' }, 'receipt', 'forever'), /unknown pin ttl/)
})

test('checkPinsSurvived reports nothing missing when all pinned objects are present', () => {
  const context = [pin({ id: 'r1' }, 'receipt'), pin({ id: 'n1' }, 'negative_result')]
  const result = checkPinsSurvived(['r1', 'n1'], context)
  assert.equal(result.all_survived, true)
  assert.deepEqual(result.missing_ids, [])
})

test('checkPinsSurvived flags a dropped pin instead of silently treating absence as safe', () => {
  const context = [pin({ id: 'r1' }, 'receipt')] // n1 was expected but compaction dropped it
  const result = checkPinsSurvived(['r1', 'n1'], context)
  assert.equal(result.all_survived, false)
  assert.deepEqual(result.missing_ids, ['n1'])
  assert.equal(result.on_missing, 'revert_to_match_none_and_rerun_preflight')
})

test('an object present but not carrying _af_pin does not count as a surviving pin', () => {
  const context = [{ id: 'r1', match: 'hit' }] // looks like the receipt, was never actually pinned
  const result = checkPinsSurvived(['r1'], context)
  assert.equal(result.all_survived, false)
})
