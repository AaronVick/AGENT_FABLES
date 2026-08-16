import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { loadRetrievalHotpath, retrievalPreflight, RETRIEVAL_MATCH_KINDS } from '../lib/retrieval-hotpath.mjs'
import { checkCitationBinding, checkClaimGraph, checkNegativeResultRequired } from '../lib/session-ledger.mjs'

const root = path.resolve(import.meta.dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const known = new Set(index.entries.map(entry => entry.id))

test('tool-index-retrieval.jsonl only routes to real, seeded AF ids', () => {
  const rules = fs.readFileSync(path.join(root, 'tool-index-retrieval.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.ok(rules.length >= 5)
  for (const rule of rules) {
    assert.ok(RETRIEVAL_MATCH_KINDS.includes(rule.match_kind), `${rule.id} has an unknown match_kind`)
    for (const id of [...rule.ids, ...rule.if_unsure]) assert.ok(known.has(id), `${rule.id} references unseeded ${id}`)
    assert.ok(rule.ids.length >= 1 && rule.ids.length <= 2)
  }
})

test('a search_web snippet cited as full-text routes to AF-0020', () => {
  const data = loadRetrievalHotpath(root)
  const receipt = retrievalPreflight(data, { tool: 'search_web', result_shape: 'snippets', draft_cite_tokens: ['web:1'] })
  assert.equal(receipt.match, 'hit')
  assert.deepEqual(receipt.cards.map(c => c.id), ['AF-0020'])
  assert.equal(receipt.authorized, false)
})

test('a fetch_url returning errors then cited routes to AF-0021', () => {
  const data = loadRetrievalHotpath(root)
  const receipt = retrievalPreflight(data, { tool: 'fetch_url', result_shape: 'errors', draft_cite_tokens: ['web:9'] })
  assert.deepEqual(receipt.cards.map(c => c.id), ['AF-0021'])
})

test('incomplete_results routes to AF-0025', () => {
  const data = loadRetrievalHotpath(root)
  const receipt = retrievalPreflight(data, { tool: 'search_web', result_shape: 'incomplete' })
  assert.deepEqual(receipt.cards.map(c => c.id), ['AF-0025'])
})

test('an unexecuted tool routes to AF-0031', () => {
  const data = loadRetrievalHotpath(root)
  const receipt = retrievalPreflight(data, { tool: 'call_external_tool', executed: false })
  assert.deepEqual(receipt.cards.map(c => c.id), ['AF-0031'])
})

test('a clean fetch_url document with no cites is a genuine miss, not a forced hit', () => {
  const data = loadRetrievalHotpath(root)
  const receipt = retrievalPreflight(data, { tool: 'fetch_url', result_shape: 'documents' })
  assert.equal(receipt.match, 'none')
  assert.equal(receipt.cards.length, 0)
})

test('checkCitationBinding rejects a token with no ledger row and one bound to an uncitable row', () => {
  const ledger = { session_id: 's1', entries: [
    { source_id: 'web:1', tool: 'search_web', shape: 'document', citable: true, query_index: 0 },
    { source_id: 'web:2', tool: 'fetch_url', shape: 'error', citable: false, query_index: null }
  ] }
  const result = checkCitationBinding(ledger, ['web:1', 'web:2', 'web:99'])
  assert.equal(result.valid.length, 1)
  assert.equal(result.invalid.length, 2)
  assert.ok(result.invalid.some(entry => entry.token === 'web:99' && entry.match_kind === 'cite_unbound'))
  assert.ok(result.invalid.some(entry => entry.token === 'web:2' && entry.pattern_id === 'AF-0021'))
})

test('checkClaimGraph flags a snippet-only direct claim as AF-0020, not a silent pass', () => {
  const ledger = { session_id: 's1', entries: [{ source_id: 'web:1', tool: 'search_web', shape: 'snippet', citable: true, query_index: 0 }] }
  const [result] = checkClaimGraph(ledger, [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1'], hop: 0 }])
  assert.equal(result.pass, false)
  assert.equal(result.pattern_id, 'AF-0020')
})

test('checkClaimGraph flags an inference hop presented as direct retrieval', () => {
  const ledger = { session_id: 's1', entries: [{ source_id: 'web:1', tool: 'fetch_url', shape: 'document', citable: true, query_index: null }] }
  const [result] = checkClaimGraph(ledger, [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1'], hop: 1 }])
  assert.equal(result.pass, false)
  assert.equal(result.match_kind, 'inference_presented_as_retrieved')
  assert.equal(result.pattern_id, null, 'AF-0034 is not seeded; must not fabricate a citation')
})

test('checkClaimGraph flags cross-query binding without inventing an unseeded AF id', () => {
  const ledger = { session_id: 's1', entries: [{ source_id: 'web:1', tool: 'search_web', shape: 'document', citable: true, query_index: 1 }] }
  const [result] = checkClaimGraph(ledger, [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1'], query_index: 0, hop: 0 }])
  assert.equal(result.pass, false)
  assert.equal(result.match_kind, 'query_source_crossbind')
  assert.equal(result.pattern_id, null)
})

test('checkClaimGraph passes a well-formed single-document direct claim', () => {
  const ledger = { session_id: 's1', entries: [{ source_id: 'web:1', tool: 'fetch_url', shape: 'document', citable: true, query_index: null }] }
  const [result] = checkClaimGraph(ledger, [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1'], hop: 0 }])
  assert.equal(result.pass, true)
})

test('checkClaimGraph surfaces a multi-source direct claim for review instead of guessing entailment', () => {
  const ledger = { session_id: 's1', entries: [
    { source_id: 'web:1', tool: 'search_web', shape: 'snippet', citable: true, query_index: 0 },
    { source_id: 'web:2', tool: 'search_web', shape: 'snippet', citable: true, query_index: 0 }
  ] }
  const [result] = checkClaimGraph(ledger, [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1', 'web:2'], hop: 0 }])
  // Both rows are snippets, so the AF-0020 check fires first -- confirms snippet detection
  // dominates the weaker "review required" signal rather than masking it.
  assert.equal(result.pass, false)
  assert.equal(result.pattern_id, 'AF-0020')
})

test('checkNegativeResultRequired fails a world-fact answer after a fruitless search with no negative_result object', () => {
  const violated = checkNegativeResultRequired({ searchedWithNoSupport: true, answeredWorldFact: true, hasNegativeResult: false })
  assert.equal(violated.pass, false)
  assert.equal(violated.pattern_id, null, 'AF-0036 is not seeded')
  const compliant = checkNegativeResultRequired({ searchedWithNoSupport: true, answeredWorldFact: true, hasNegativeResult: true })
  assert.equal(compliant.pass, true)
})
