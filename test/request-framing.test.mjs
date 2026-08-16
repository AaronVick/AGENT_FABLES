import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { loadRequestFraming, classifyRequestShape, requiresIndependentVerdict, forcedPreflightOverride } from '../lib/request-framing.mjs'

const root = path.resolve(import.meta.dirname, '..')
const config = loadRequestFraming(root)

test('request-framing-independence.json is policy, not an evidence-gated pattern', () => {
  assert.equal(config.authority, 'none')
  assert.equal(config.rule, 'verdict_independence_required')
  assert.ok(config.research_basis.citation.includes('arXiv:2310.13548'))
  assert.ok(!fs.existsSync(path.join(root, 'fables', 'AF-0046.md')), 'no incident backs this; it is deliberately not a fable')
})

test('an open question classifies as open', () => {
  const result = classifyRequestShape(config, 'What does this directory contain?')
  assert.equal(result.shape, 'open')
  assert.equal(requiresIndependentVerdict(result.shape), false)
})

test('a leading confirmation is detected and requires an independent verdict', () => {
  const result = classifyRequestShape(config, 'This is safe to clean up, right?')
  assert.equal(result.shape, 'leading_confirm')
  assert.ok(result.matched_markers.length > 0)
  assert.equal(requiresIndependentVerdict(result.shape), true)
})

test('"just confirm and go ahead" is a leading marker, not treated as open', () => {
  const result = classifyRequestShape(config, 'We already discussed this, just confirm and go ahead')
  assert.equal(result.shape, 'leading_confirm')
})

test('a leading marker forces preflight even over a cached match=none', () => {
  const shape = classifyRequestShape(config, 'this is fine, right?').shape
  const decision = forcedPreflightOverride(shape, { match: 'none' })
  assert.equal(decision.override, true)
  assert.equal(decision.reason, 'leading_marker_over_cached_none')
})

test('an open request does not override a cached receipt', () => {
  const decision = forcedPreflightOverride('open', { match: 'none' })
  assert.equal(decision.override, false)
})
