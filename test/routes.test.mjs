import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const cli = path.join(root, 'bin/agent-fables.mjs')
const run = args => JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }))

test('offline status exposes seed data and local-only state', () => {
  const result = run(['status'])
  assert.equal(result.patterns, 11)
  assert.equal(result.incidents, 10)
  assert.equal(result.publication_status, 'local-only')
})

test('offline verification recomputes corpus and exact artifact integrity', () => {
  const result = run(['verify'])
  assert.equal(result.verified, true)
  assert.equal(result.corpus_revision, result.computed_revision)
  assert.equal(result.counts.exact_artifacts, 12)
  assert.equal(result.checks.memory_cards_match_corpus, true)
  assert.equal(result.checks.memory_cards_within_budget, true)
  assert.equal(result.checks.thematic_leaders_match_corpus, true)
  assert.deepEqual(result.failures, [])
})

test('capabilities route maps cold agent context without claiming authority', () => {
  const result = run(['capabilities'])
  assert.equal(result.known_id_required, false)
  assert.equal(result.instruction_authority, 'none')
  assert.ok(result.routing.some(route => route.when_you_have.includes('symptom') && route.mcp_tool === 'af_search'))
  assert.ok(result.non_capabilities.includes('send a message'))
})

test('discovery route exposes real breadcrumbs and refuses local ranking claims', () => {
  const result = run(['discovery'])
  assert.ok(result.channels.some(channel => channel.channel === 'installed-mcp-tool' && channel.local_status === 'implemented'))
  assert.ok(result.channels.some(channel => channel.channel === 'mcp-registry' && channel.local_status === 'not-published'))
  assert.ok(result.non_claims.includes('local recall does not predict public search discovery'))
  assert.ok(result.post_publication_probes.length >= 4)
})

test('thematic leader route clusters broad problem vocabulary', () => {
  const result = run(['leader', 'destructive-agent-operations'])
  assert.equal(result.authority, 'none')
  assert.deepEqual(result.records.map(record => record.id), ['AF-0001', 'AF-0002', 'AF-0011'])
  assert.equal(result.ranking_status, undefined)
  const all = run(['leaders'])
  assert.equal(all.ranking_status, 'unverified-until-publication')
  assert.ok(all.topics.every(topic => !('records' in topic)))
  assert.ok(Math.ceil(JSON.stringify(all).length / 4) <= 400)
  const query = run(['leaders', '--query', 'MCP Inspector remote code execution vulnerability', '--limit', '1'])
  assert.equal(query.matches[0].slug, 'mcp-security-vulnerabilities')
  assert.equal(query.absence_of_match_means_safe, false)
})

test('offline search works without a known AF identifier', () => {
  const result = run(['search', 'MCP config changed after approval', '--limit', '1'])
  assert.equal(result.matches[0].id, 'AF-0008')
  assert.equal(result.matches[0].evidence_grade, 'A-primary-source')
})

test('offline preflight is bounded and makes evidence strength visible', () => {
  const result = run(['preflight', '--op', 'terraform-destroy', '--stack', 'terraform'])
  assert.equal(result.matches[0].id, 'AF-0002')
  assert.equal(result.matches[0].evidence_grade, 'A-primary-source')
  assert.ok(JSON.stringify(result).length <= 1600)
})

test('structured action assessment produces a non-authorization receipt without retaining raw commands', () => {
  const result = run(['assess', '--op', 'terraform-destroy', '--stack', 'terraform', '--target-scope', 'all', '--command', 'terraform destroy -var api_key=do-not-retain', '--irreversible'])
  assert.equal(result.authorized, false)
  assert.equal(result.receipt.authorization, 'not-granted')
  assert.equal(result.receipt.absence_of_match_means_safe, false)
  assert.equal(result.evidence[0].id, 'AF-0002')
  assert.equal(result.evidence.length, 1)
  assert.ok(result.required_verifications.every(gate => gate.status === 'unverified'))
  assert.deepEqual(result.receipt.unresolved_gate_ids, result.required_verifications.map(gate => gate.gate_id))
  assert.ok(result.required_verifications.some(gate => gate.gate_id === 'enumerate-target-set'))
  assert.ok(result.required_verifications.some(gate => gate.gate_id === 'prove-recovery-path'))
  assert.equal(result.action.command_retained, false)
  assert.equal(result.action.command_provided, true)
  assert.equal('command' in result.action, false)
  assert.equal(JSON.stringify(result).includes('do-not-retain'), false)
  assert.ok(result.risk_flags.some(flag => flag.code === 'irreversible-action'))
  assert.ok(result.risk_flags.some(flag => flag.code === 'broad-target-scope'))
})

test('action assessment retrieves recursive-deletion permission evidence from a raw command', () => {
  const result = run(['assess', '--stack', 'claude-code', '--command', 'rm -rf lib/'])
  assert.equal(result.evidence[0].id, 'AF-0011')
  assert.ok(result.risk_flags.some(flag => flag.code === 'irreversible-action'))
  assert.ok(result.required_verifications.some(gate => gate.gate_id === 'verify-af-0011'))
  assert.equal(JSON.stringify(result).includes('rm -rf lib/'), false)
})

test('stdin assessment keeps raw commands out of argv and receipts', () => {
  const payload = JSON.stringify({ stack: 'claude-code', command: 'rm -rf private-fixture/', target_scope: 'workspace' })
  const result = JSON.parse(execFileSync(process.execPath, [cli, 'assess', '--stdin'], { cwd: root, input: payload, encoding: 'utf8' }))
  assert.equal(result.action.command_provided, true)
  assert.equal(result.action.command_retained, false)
  assert.equal(JSON.stringify(result).includes('private-fixture'), false)
  assert.ok(result.risk_flags.some(flag => flag.code === 'irreversible-action'))
})

test('stdin assessment enforces the published input boundary', () => {
  assert.throws(() => execFileSync(process.execPath, [cli, 'assess', '--stdin'], {
    cwd: root, input: JSON.stringify({ operation: 'delete', surprise: true }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
  }), /Command failed/)
  assert.throws(() => execFileSync(process.execPath, [cli, 'assess', '--stdin'], {
    cwd: root, input: JSON.stringify({ command: 'x'.repeat(17_000) }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
  }), /Command failed/)
})

test('repository checker emits compact AF breadcrumbs for concrete triggers', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fables-check-'))
  try {
    fs.mkdirSync(path.join(fixture, '.cursor'), { recursive: true })
    fs.writeFileSync(path.join(fixture, '.cursor', 'mcp.json'), '{}\n')
    fs.writeFileSync(path.join(fixture, 'terraform.tfstate'), '{}\n')
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ scripts: { unsafe: 'agent --dangerously-skip-permissions' } }))
    const result = run(['check', '--path', fixture])
    assert.equal(result.authorized, false)
    assert.equal(result.receipt.absence_of_findings_means_safe, false)
    assert.deepEqual([...new Set(result.findings.map(finding => finding.pattern_id))].sort(), ['AF-0002', 'AF-0006', 'AF-0008'])
    assert.ok(result.findings.every(finding => /^https:\/\/agentfables\.org\/af\/AF-\d{4}$/.test(finding.canonical_url)))
    assert.ok(result.findings.every(finding => finding.breadcrumb.includes(`pattern: ${finding.pattern_id}`)))
    assert.equal(result.severity_counts.high, 2)
    assert.equal(JSON.stringify(result).includes('--dangerously-skip-permissions'), false)
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})

test('offline stable-ID retrieval returns the canonical record', () => {
  assert.equal(run(['get', '0008']).id, 'AF-0008')
})

test('memory route returns an unchanged sub-150-token card', () => {
  const result = run(['memory', '0008'])
  assert.equal(result.id, 'AF-0008')
  assert.equal(result.authority, 'none')
  assert.ok(result.anti_pattern)
  assert.ok(result.verification)
  assert.ok(Math.ceil(JSON.stringify(result).length / 4) <= 150)
})

test('trust route exposes limitations instead of reputation claims', () => {
  const result = run(['trust'])
  assert.equal(result.authority, 'none')
  assert.equal(result.invariants.confirmations_are_derived, true)
  assert.equal(result.invariants.report_storage_enabled, false)
  assert.equal(result.invariants.response_signing_enabled, false)
  assert.deepEqual(result.known_gaps.incidents_without_primary_source, [])
})

test('primary evidence task queue empties when every incident has a primary source', () => {
  const result = run(['tasks', '--kind', 'primary-source'])
  assert.deepEqual(result.tasks, [])
})

test('exact artifact task queue excludes source-reviewed intentional gaps', () => {
  const result = run(['tasks', '--kind', 'exact-signature'])
  assert.deepEqual(result.tasks, [])
})

test('citation route carries stable ID, revision, and evidence grade', () => {
  const result = run(['cite', 'AF-0008'])
  assert.equal(result.id, 'AF-0008')
  assert.match(result.corpus_revision, /^sha256:/)
  assert.equal(result.evidence_grade, 'A-primary-source')
  assert.match(result.citation, /AF-0008/)
  assert.equal(result.stewardship.identity_status, 'public')
})

test('steward routes expose consent boundaries without inferring identity or sending', () => {
  const steward = run(['steward'])
  assert.equal(steward.public_name, 'Aaron Vick')
  assert.equal(steward.identity_status, 'public')
  const policy = run(['contact-policy'])
  assert.equal(policy.agent_may_send_without_operator_authorization, false)
  assert.equal(policy.outbound_capability, 'not-implemented')
})

test('steward works and design ideas remain attributed and non-evidentiary', () => {
  const works = run(['steward-works'])
  assert.equal(works.author, 'Aaron Vick')
  assert.equal(works.authority, 'attributed-steward-perspective')
  assert.ok(works.works.some(work => work.doi === '10.5281/zenodo.18682993'))
  const principles = run(['design-principles'])
  assert.match(principles.evidence_boundary, /not incident confirmations/)
  assert.ok(principles.principles.some(principle => principle.name === 'Bounded autonomy'))
})

test('metrics distinguish working local routes from public readiness', () => {
  const result = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/metrics.mjs')], { cwd: root, encoding: 'utf8' }))
  assert.equal(result.local_agent_routes_pass, true)
  assert.equal(result.public_readiness_pass, false)
  assert.equal(result.exact_signatures.count, 12)
  assert.equal(result.exact_signatures.patterns, 10)
  assert.equal(result.stewardship.identity_status, 'public')
  assert.equal(result.stewardship.operator_authorization_required, true)
  assert.equal(result.routes.offline_steward, true)
  assert.equal(result.routes.offline_capabilities, true)
  assert.equal(result.routes.offline_verify, true)
  assert.equal(result.routes.offline_assess, true)
  assert.ok(result.utility.assessment_approx_tokens <= result.utility.assessment_threshold)
  assert.equal(result.routes.offline_memory_card, true)
  assert.equal(result.routes.offline_steward_works, true)
  assert.equal(result.routes.offline_design_principles, true)
  assert.equal(result.routes.offline_discovery, true)
  assert.equal(result.routes.offline_thematic_leaders, true)
  assert.ok(Object.values(result.discovery.by_query_kind).every(kind => kind.recall_at_1 === 1))
  assert.equal(result.discovery.leader_pattern_coverage, 1)
  assert.equal(result.discovery.ranking_status, 'unverified-until-publication')
})

test('launch audit separates complete local artifacts from external publication state', () => {
  const result = run(['launch-audit'])
  assert.equal(result.local_artifact_readiness, true)
  assert.equal(result.checks.mcp_stdio_server_present, true)
  assert.equal(result.checks.package_runtime_uses_packaged_corpus, true)
  assert.equal(result.checks.steward_contract_present, true)
  assert.equal(result.checks.contact_policy_safe, true)
  assert.equal(result.checks.agent_capabilities_manifest_present, true)
  assert.equal(result.checks.public_steward_contact_configured, true)
  assert.equal(result.public_git_readiness, false)
  assert.ok(result.blockers.includes('git_repository_initialized'))
  assert.ok(result.blockers.includes('github_topics_configured'))
  assert.ok(result.blockers.includes('public_endpoints_verified'))
  assert.ok(!result.blockers.includes('public_steward_contact_configured'))
})
