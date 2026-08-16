import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { loadToolAliases, normalizeToolName } from '../lib/tool-normalize.mjs'

const root = path.resolve(import.meta.dirname, '..')
const aliases = loadToolAliases(root)

test('a canonical tool name passes through unchanged', () => {
  assert.equal(normalizeToolName(aliases, 'fetch_url'), 'fetch_url')
})

test('common alias names resolve to the canonical tool the rule files key on', () => {
  assert.equal(normalizeToolName(aliases, 'browse'), 'fetch_url')
  assert.equal(normalizeToolName(aliases, 'web_search'), 'search_web')
  assert.equal(normalizeToolName(aliases, 'read_file'), 'get_file_contents')
  assert.equal(normalizeToolName(aliases, 'shell'), 'bash')
})

test('normalization is case-insensitive', () => {
  assert.equal(normalizeToolName(aliases, 'Web_Search'), 'search_web')
})

test('an unknown tool name passes through unchanged rather than being dropped or guessed', () => {
  assert.equal(normalizeToolName(aliases, 'some_brand_new_tool_nobody_has_seen'), 'some_brand_new_tool_nobody_has_seen')
})

test('every alias target is itself a listed canonical tool, not a typo pointing nowhere', () => {
  for (const canonical of Object.keys(aliases.aliases)) {
    assert.ok(aliases.canonical_tools.includes(canonical), `aliases map to ${canonical}, which is not in canonical_tools`)
  }
})

test('canonical tool names either key a rule.tool field or are matched by a tool-agnostic rule/predicate', () => {
  // memory_search and call_external_tool have no rule.tool literal yet (memory_as_world
  // is intentionally not wired per predicate-registry.json; unexecuted_as_done is
  // deliberately tool-agnostic) -- both are real, referenced in retrievalPreflight's own
  // predicate logic, not dead aliases pointing at nothing.
  const readJsonl = file => fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const ruleScopedTools = new Set([...readJsonl('tool-index.jsonl'), ...readJsonl('tool-index-retrieval.jsonl')].map(rule => rule.tool).filter(Boolean))
  const relevantSource = ['lib/retrieval-hotpath.mjs', 'schemas/hotpath-input.schema.json', 'test/retrieval-hotpath.test.mjs']
    .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
  for (const canonical of aliases.canonical_tools) {
    const referenced = ruleScopedTools.has(canonical) || relevantSource.includes(`'${canonical}'`) || relevantSource.includes(`"${canonical}"`)
    assert.ok(referenced, `${canonical} is listed as canonical but appears nowhere in the actual matching logic`)
  }
})

test('no alias silently duplicates a different canonical tool', () => {
  const allAliasValues = Object.values(aliases.aliases).flat()
  assert.equal(new Set(allAliasValues).size, allAliasValues.length, 'an alias string should not appear under two different canonical tools')
})
