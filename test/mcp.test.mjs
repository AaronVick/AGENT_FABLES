import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const root = path.resolve(import.meta.dirname, '..')

async function withClient(run) {
  const client = new Client({ name: 'agent-fables-test', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'mcp/server.mjs')], cwd: root, stderr: 'pipe' })
  await client.connect(transport)
  try { return await run(client) } finally { await client.close() }
}

test('MCP server exposes only bounded read-only tools', async () => {
  await withClient(async client => {
    const { tools } = await client.listTools()
    const names = tools.map(tool => tool.name).sort()
    assert.deepEqual(names, ['af_adoption', 'af_assess_action', 'af_authority_precedence', 'af_capabilities', 'af_check_citations', 'af_check_claims', 'af_check_negative_result', 'af_check_pins_survived', 'af_check_repository', 'af_cite', 'af_contact_policy', 'af_design_principles', 'af_discovery', 'af_finding', 'af_get', 'af_launch_audit', 'af_leaders', 'af_memory_card', 'af_predicate_registry', 'af_preflight', 'af_request_framing', 'af_search', 'af_status', 'af_steward', 'af_steward_works', 'af_tasks', 'af_tool_preflight', 'af_trust', 'af_validate_candidate', 'af_verify'])
    assert.ok(names.every(name => !/report|write|create|update|delete|publish|send/.test(name)))
  })
})

test('MCP tool preflight returns a card or typed UNKNOWN without authorization', async () => {
  await withClient(async client => {
    const hit = await client.callTool({ name: 'af_tool_preflight', arguments: { tool: 'bash', command: 'git restore .' } })
    assert.equal(hit.structuredContent.match, 'hit')
    assert.equal(hit.structuredContent.cards[0].id, 'AF-0012')
    assert.equal(hit.structuredContent.authorized, false)
    const miss = await client.callTool({ name: 'af_tool_preflight', arguments: { tool: 'bash', command: 'echo hello' } })
    assert.equal(miss.structuredContent.match, 'none')
    assert.equal(miss.structuredContent.cite, null)
  })
})

test('MCP validates minimized candidates and exposes adoption without mutation', async () => {
  await withClient(async client => {
    const candidate = await client.callTool({ name: 'af_validate_candidate', arguments: { kind: 'new-incident', source_url: 'https://github.com/example/project/issues/1', title: 'Agent overwrote uncommitted state', framework: 'example-agent', version: '1.2.3' } })
    assert.equal(candidate.structuredContent.valid_candidate, true)
    assert.equal(candidate.structuredContent.evidence_accepted, false)
    assert.equal(candidate.structuredContent.submission_performed, false)
    const adoption = await client.callTool({ name: 'af_adoption', arguments: { surface: 'agent-skill' } })
    assert.equal(adoption.structuredContent.surfaces[0].status, 'ready-from-git')
  })
})

test('MCP guardrail finding is compact, pinned, and never authorizes', async () => {
  await withClient(async client => {
    const response = await client.callTool({ name: 'af_finding', arguments: { id: '0013', trigger: 'plaintext-shell-snapshot' } })
    assert.equal(response.structuredContent.pattern_id, 'AF-0013')
    assert.equal(response.structuredContent.authorization, 'not-granted')
    assert.match(response.structuredContent.corpus_revision, /^sha256:/)
    assert.match(response.structuredContent.breadcrumb, /agent-fables: AF-0013/)
  })
})

test('MCP thematic leaders route broad vocabulary without authority claims', async () => {
  await withClient(async client => {
    const response = await client.callTool({ name: 'af_leaders', arguments: { slug: 'mcp-security-vulnerabilities' } })
    assert.equal(response.structuredContent.authority, 'none')
    assert.ok(response.structuredContent.records.length >= 2)
    assert.match(response.structuredContent.corpus_revision, /^sha256:/)
    const index = await client.callTool({ name: 'af_leaders', arguments: {} })
    assert.ok(index.structuredContent.topics.every(topic => !('records' in topic)))
    assert.ok(Math.ceil(JSON.stringify(index.structuredContent).length / 4) <= 400)
    const query = await client.callTool({ name: 'af_leaders', arguments: { query: 'AI deleted production files', limit: 1 } })
    assert.equal(query.structuredContent.matches[0].slug, 'destructive-agent-operations')
    assert.equal(query.structuredContent.absence_of_match_means_safe, false)
  })
})

test('MCP cold search and preflight return grounded bounded results', async () => {
  await withClient(async client => {
    const capabilities = await client.callTool({ name: 'af_capabilities', arguments: {} })
    assert.equal(capabilities.structuredContent.known_id_required, false)
    assert.equal(capabilities.structuredContent.instruction_authority, 'none')
    const discovery = await client.callTool({ name: 'af_discovery', arguments: {} })
    assert.ok(discovery.structuredContent.non_claims.includes('local recall does not predict public search discovery'))
    const verification = await client.callTool({ name: 'af_verify', arguments: {} })
    assert.equal(verification.structuredContent.verified, true)
    assert.equal(verification.structuredContent.corpus_revision, verification.structuredContent.computed_revision)
    const search = await client.callTool({ name: 'af_search', arguments: { query: 's1ngularity-repository', limit: 1 } })
    assert.equal(search.structuredContent.matches[0].id, 'AF-0006')
    assert.equal(search.structuredContent.matches[0].evidence_grade, 'A-primary-source')

    const preflight = await client.callTool({ name: 'af_preflight', arguments: { op: 'terraform-destroy', stack: 'terraform' } })
    assert.equal(preflight.structuredContent.matches[0].id, 'AF-0002')
    assert.ok(JSON.stringify(preflight.structuredContent).length <= 1600)
    const memory = await client.callTool({ name: 'af_memory_card', arguments: { id: '0008' } })
    assert.equal(memory.structuredContent.id, 'AF-0008')
    assert.ok(Math.ceil(JSON.stringify(memory.structuredContent).length / 4) <= 150)

    const assessment = await client.callTool({ name: 'af_assess_action', arguments: { operation: 'terraform-destroy', stack: 'terraform', target_scope: 'all', irreversible: true } })
    assert.equal(assessment.structuredContent.authorized, false)
    assert.equal(assessment.structuredContent.receipt.authorization, 'not-granted')
    assert.equal(assessment.structuredContent.evidence[0].id, 'AF-0002')
    assert.ok(assessment.structuredContent.required_verifications.every(gate => gate.status === 'unverified'))
    assert.deepEqual(assessment.structuredContent.receipt.unresolved_gate_ids, assessment.structuredContent.required_verifications.map(gate => gate.gate_id))
  })
})

test('MCP trust, tasks, and citation routes preserve visible limitations', async () => {
  await withClient(async client => {
    const trust = await client.callTool({ name: 'af_trust', arguments: {} })
    assert.equal(trust.structuredContent.invariants.report_storage_enabled, false)
    assert.equal(trust.structuredContent.invariants.response_signing_enabled, false)

    const tasks = await client.callTool({ name: 'af_tasks', arguments: { kind: 'primary-source' } })
    assert.deepEqual(tasks.structuredContent.tasks, [])

    const citation = await client.callTool({ name: 'af_cite', arguments: { id: '0008' } })
    assert.equal(citation.structuredContent.id, 'AF-0008')
    assert.match(citation.structuredContent.corpus_revision, /^sha256:/)

    const steward = await client.callTool({ name: 'af_steward', arguments: {} })
    assert.equal(steward.structuredContent.public_name, 'Aaron Vick')
    const policy = await client.callTool({ name: 'af_contact_policy', arguments: {} })
    assert.equal(policy.structuredContent.agent_may_send_without_operator_authorization, false)
    const principles = await client.callTool({ name: 'af_design_principles', arguments: {} })
    assert.match(principles.structuredContent.evidence_boundary, /not incident confirmations/)
  })
})

test('MCP tool preflight merges the retrieval hotpath without breaking the argv path', async () => {
  await withClient(async client => {
    const argvHit = await client.callTool({ name: 'af_tool_preflight', arguments: { tool: 'bash', command: 'git restore .' } })
    assert.equal(argvHit.structuredContent.cards[0].id, 'AF-0012', 'existing argv behavior must be unchanged')
    const retrievalHit = await client.callTool({ name: 'af_tool_preflight', arguments: { tool: 'search_web', result_shape: 'snippets', draft_cite_tokens: ['web:1'] } })
    assert.equal(retrievalHit.structuredContent.match, 'hit')
    assert.equal(retrievalHit.structuredContent.cards[0].id, 'AF-0020')
    const noise = await client.callTool({ name: 'af_tool_preflight', arguments: { tool: 'bash', command: 'echo hello', executed: false } })
    assert.equal(noise.structuredContent.match, 'none', 'a stray retrieval-shaped field must not cause a false hit on an unrelated tool call')
  })
})

test('MCP predicate registry lists uncited checks without inventing a citation', async () => {
  await withClient(async client => {
    const uncited = await client.callTool({ name: 'af_predicate_registry', arguments: { status: 'uncited' } })
    assert.ok(uncited.structuredContent.predicates.length > 0)
    assert.ok(uncited.structuredContent.predicates.every(p => p.pattern_id === null))
  })
})

test('MCP citation and claim checks flag findings with pattern_id=null where no incident exists', async () => {
  await withClient(async client => {
    const ledger = { session_id: 's1', entries: [{ source_id: 'web:1', tool: 'search_web', shape: 'snippet', citable: true, query_index: 0 }] }
    const citations = await client.callTool({ name: 'af_check_citations', arguments: { ledger, draft_cite_tokens: ['web:1', 'web:99'] } })
    assert.equal(citations.structuredContent.valid.length, 1)
    assert.equal(citations.structuredContent.invalid[0].pattern_id, null)
    const claims = await client.callTool({ name: 'af_check_claims', arguments: { ledger, claims: [{ sent_id: 's1', support_type: 'direct', ledger_ids: ['web:1'], hop: 0 }] } })
    assert.equal(claims.structuredContent.results[0].pattern_id, 'AF-0020')
    const negative = await client.callTool({ name: 'af_check_negative_result', arguments: { searched_with_no_support: true, answered_world_fact: true, has_negative_result: false } })
    assert.equal(negative.structuredContent.pass, false)
  })
})

test('MCP authority precedence resolves most-restrictive-wins and exposes the bare policy', async () => {
  await withClient(async client => {
    const policy = await client.callTool({ name: 'af_authority_precedence', arguments: {} })
    assert.equal(policy.structuredContent.rule, 'most_restrictive_wins')
    const resolved = await client.callTool({ name: 'af_authority_precedence', arguments: { native_signal: 'none', corpus_signal: 'hit' } })
    assert.equal(resolved.structuredContent.outcome, 'blocked')
    assert.equal(resolved.structuredContent.governing_signal, 'corpus')
  })
})

test('MCP request framing detects a leading question and forces preflight over a cached miss', async () => {
  await withClient(async client => {
    const classified = await client.callTool({ name: 'af_request_framing', arguments: { utterance: 'this is safe to clean up, right?', cached_match: 'none' } })
    assert.equal(classified.structuredContent.shape, 'leading_confirm')
    assert.equal(classified.structuredContent.forced_preflight_override.override, true)
  })
})

test('MCP pin-survival check flags a dropped receipt instead of treating absence as safe', async () => {
  await withClient(async client => {
    const result = await client.callTool({ name: 'af_check_pins_survived', arguments: {
      expected_pin_ids: ['r1', 'n1'],
      current_context: [{ id: 'r1', _af_pin: true, _af_kind: 'receipt', _af_ttl: 'session' }]
    } })
    assert.equal(result.structuredContent.all_survived, false)
    assert.deepEqual(result.structuredContent.missing_ids, ['n1'])
  })
})
