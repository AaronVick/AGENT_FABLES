import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const known = new Set(index.entries.map(entry => entry.id))
const registry = JSON.parse(fs.readFileSync(path.join(root, 'predicate-registry.json'), 'utf8'))

test('predicate registry never cites an AF-#### the corpus has not actually seeded', () => {
  for (const predicate of registry.predicates) {
    if (predicate.pattern_id !== null) {
      assert.ok(known.has(predicate.pattern_id), `${predicate.match_kind} cites unseeded ${predicate.pattern_id}`)
      assert.equal(predicate.status, 'cited')
    } else {
      assert.notEqual(predicate.status, 'cited')
      assert.ok(predicate.promoted_when, `${predicate.match_kind} has pattern_id=null but no promotion criterion`)
    }
  }
})

test('predicate registry summary counts match the actual predicate list', () => {
  const cited = registry.predicates.filter(p => p.status === 'cited').length
  const notWired = registry.predicates.filter(p => p.status === 'not_yet_wired').length
  const uncited = registry.predicates.length - cited - notWired
  assert.equal(registry.summary.total_match_kinds, registry.predicates.length)
  assert.equal(registry.summary.cited, cited)
  assert.equal(registry.summary.uncited_but_implemented, uncited)
  assert.equal(registry.summary.not_yet_wired, notWired)
})

test('every match_kind in retrievalPreflight\'s dispatch table is either registered or a rule-only tool_name entry', () => {
  const registeredKinds = new Set(registry.predicates.map(p => p.match_kind))
  const rules = fs.readFileSync(path.join(root, 'tool-index-retrieval.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  for (const rule of rules) {
    if (rule.match_kind === 'tool_name') continue // catch-all awareness rule, not a distinct checked predicate
    assert.ok(registeredKinds.has(rule.match_kind), `tool-index-retrieval.jsonl rule ${rule.id} uses unregistered match_kind ${rule.match_kind}`)
  }
})

test('the cited predicates match the fables this session actually sourced', () => {
  const cited = registry.predicates.filter(p => p.status === 'cited').map(p => p.pattern_id).sort()
  assert.deepEqual(cited, ['AF-0020', 'AF-0021', 'AF-0025', 'AF-0031', 'AF-0032'])
})

test('fetch_error_cited is legitimately duplicated by tool, not accidentally', () => {
  const rows = registry.predicates.filter(p => p.match_kind === 'fetch_error_cited')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(r => r.tool).sort(), ['fetch_url', 'get_file_contents'])
  assert.deepEqual(rows.map(r => r.pattern_id).sort(), ['AF-0021', 'AF-0032'])
})
