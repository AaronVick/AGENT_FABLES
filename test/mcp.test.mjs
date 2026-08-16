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
    assert.deepEqual(names, ['af_assess_action', 'af_capabilities', 'af_check_repository', 'af_cite', 'af_contact_policy', 'af_design_principles', 'af_discovery', 'af_get', 'af_launch_audit', 'af_leaders', 'af_memory_card', 'af_preflight', 'af_search', 'af_status', 'af_steward', 'af_steward_works', 'af_tasks', 'af_trust', 'af_verify'])
    assert.ok(names.every(name => !/report|write|create|update|delete|publish|send/.test(name)))
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
