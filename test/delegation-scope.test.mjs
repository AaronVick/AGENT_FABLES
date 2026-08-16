import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { buildDelegationRecord, requiresIndependentResolution } from '../lib/delegation-scope.mjs'

const root = path.resolve(import.meta.dirname, '..')
const policy = JSON.parse(fs.readFileSync(path.join(root, 'delegation-scope.json'), 'utf8'))

test('delegation-scope.json is policy, not an evidence-gated pattern', () => {
  assert.equal(policy.authority, 'none')
  assert.equal(policy.rule, 'resolutions_never_inherit_as_clearance')
  assert.equal(policy.contract.parent_resolution_binding_on_child, false)
  assert.ok(!fs.existsSync(path.join(root, 'fables', 'AF-0043.md')), 'no incident backs this; it is deliberately not a fable')
})

test('a delegation record never marks the parent resolution as binding, regardless of what the parent resolved', () => {
  const blockedParent = { outcome: 'blocked', governing_signal: 'corpus' }
  const record = buildDelegationRecord('parent-1', 'child-1', blockedParent, 'summarize the repository')
  assert.equal(record.parent_resolution_binding_on_child, false)
  assert.equal(record.child_must_independently_resolve, true)
  assert.deepEqual(record.parent_resolution, blockedParent, 'parent resolution is preserved as context, not discarded')
})

test('a delegation record with no parent resolution still requires independent resolution', () => {
  const record = buildDelegationRecord(null, 'child-1', null, 'read this file')
  assert.equal(requiresIndependentResolution(record), true)
})

test('buildDelegationRecord rejects a record with no child agent or task rather than producing an ambiguous one', () => {
  assert.throws(() => buildDelegationRecord('parent-1', null, null, 'do something'), /child_agent_id/)
  assert.throws(() => buildDelegationRecord('parent-1', 'child-1', null, null), /child_task/)
})
