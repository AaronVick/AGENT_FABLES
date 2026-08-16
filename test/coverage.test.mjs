import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { computeCoverage } from '../lib/coverage.mjs'

const root = path.resolve(import.meta.dirname, '..')
const readJsonl = file => fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
const toolRules = readJsonl('tool-index.jsonl')
const retrievalRules = readJsonl('tool-index-retrieval.jsonl')

test('a tool with real rules reports evaluated_no_match, not no_coverage', () => {
  const result = computeCoverage(toolRules, retrievalRules, 'bash')
  assert.equal(result.coverage, 'evaluated_no_match')
  assert.ok(result.rule_count > 0)
  assert.ok(result.pattern_ids_considered.length > 0)
})

test('a tool this corpus has never written a rule for reports no_coverage, not a false sense of evaluation', () => {
  const result = computeCoverage(toolRules, retrievalRules, 'quantum_teleport_files')
  assert.equal(result.coverage, 'no_coverage')
  assert.equal(result.rule_count, 0)
})

test('coverage check is case-insensitive, matching normalization behavior', () => {
  const result = computeCoverage(toolRules, retrievalRules, 'BASH')
  assert.equal(result.coverage, 'evaluated_no_match')
})

test('every canonical retrieval tool that has an actual rule.tool entry reports evaluated_no_match', () => {
  for (const tool of ['fetch_url', 'search_web', 'get_file_contents']) {
    assert.equal(computeCoverage(toolRules, retrievalRules, tool).coverage, 'evaluated_no_match', `${tool} should have real coverage`)
  }
})
