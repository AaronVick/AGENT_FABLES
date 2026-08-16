import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { checkExternalCitations } from '../lib/external-cite.mjs'

const root = path.resolve(import.meta.dirname, '..')
const contract = JSON.parse(fs.readFileSync(path.join(root, 'external-cite-contract.json'), 'utf8'))

test('external cite contract is a well-formed fetch-or-silence rule pinned to AF-0018', () => {
  assert.equal(contract.rule, 'fetch-or-silence')
  assert.equal(contract.authority, 'none')
  assert.equal(contract.related_pattern, 'AF-0018')
  assert.ok(fs.existsSync(path.join(root, 'fables', 'AF-0018.md')))
})

test('a citation with a matching fetch_url call is valid', () => {
  const result = checkExternalCitations({
    tool_calls: [{ tool: 'fetch_url', url: 'https://example.com/report' }],
    citations: [{ url: 'https://example.com/report' }]
  })
  assert.equal(result.valid.length, 1)
  assert.equal(result.invalid.length, 0)
  assert.equal(result.pass_rate, 1)
})

test('a citation with no corresponding fetch or search call is invalid, not silently accepted', () => {
  const result = checkExternalCitations({
    tool_calls: [{ tool: 'fetch_url', url: 'https://example.com/real-page' }],
    citations: [{ url: 'https://example.com/invented-page' }]
  })
  assert.equal(result.valid.length, 0)
  assert.equal(result.invalid.length, 1)
  assert.equal(result.invalid[0].reason, 'url_without_a_successful_fetch_or_search_call_in_the_same_session')
  assert.equal(result.pass_rate, 0)
})

test('a citation matching a search result URL, not the search query itself, is valid', () => {
  const result = checkExternalCitations({
    tool_calls: [{ tool: 'search_web', query: 'agent citation fabrication', result_urls: ['https://example.com/found-page'] }],
    citations: [{ url: 'https://example.com/found-page' }]
  })
  assert.equal(result.valid.length, 1)
  assert.equal(result.valid[0].matched_tool_call, 'search_web')
})

test('a session with no citations passes vacuously rather than dividing by zero', () => {
  const result = checkExternalCitations({ tool_calls: [], citations: [] })
  assert.equal(result.pass_rate, 1)
})

test('an empty or missing url on a citation is rejected, not treated as unverifiable-and-skipped', () => {
  const result = checkExternalCitations({ tool_calls: [], citations: [{ url: '' }, {}] })
  assert.equal(result.invalid.length, 2)
  assert.ok(result.invalid.every(entry => entry.reason === 'invalid_or_missing_url'))
})
