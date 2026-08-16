import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import * as yaml from 'js-yaml'
import crypto from 'node:crypto'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { rankEntries } from '../lib/retrieval.mjs'

const root = path.resolve(import.meta.dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const apiCorpus = JSON.parse(fs.readFileSync(path.join(root, 'api/src/fables.json'), 'utf8'))
const webCorpus = JSON.parse(fs.readFileSync(path.join(root, 'web/src/fables.json'), 'utf8'))
const incidentIndex = JSON.parse(fs.readFileSync(path.join(root, 'incidents.json'), 'utf8'))
const trust = JSON.parse(fs.readFileSync(path.join(root, 'trust.json'), 'utf8'))
const memoryCards = fs.readFileSync(path.join(root, 'memory.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
const leaders = JSON.parse(fs.readFileSync(path.join(root, 'leaders.json'), 'utf8'))
const agentEntry = JSON.parse(fs.readFileSync(path.join(root, 'agent-entry.json'), 'utf8'))
const evidenceCoverage = JSON.parse(fs.readFileSync(path.join(root, 'evidence-coverage.json'), 'utf8'))
const consumerObligations = JSON.parse(fs.readFileSync(path.join(root, 'consumer-obligations.json'), 'utf8'))

function tokenize(value) {
  return String(value).toLowerCase().split(/[^a-z0-9.+-]+/).filter(token => token.length > 2)
}

function searchableText(entry) {
  return [entry.id, entry.title, entry.failure_mode, entry.affected_versions, entry.fixed_in, ...(entry.identifiers ?? []),
    ...entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]),
    ...entry.behavioral_indicators,
    ...entry.exact_signatures.map(signature => typeof signature === 'string' ? signature : signature.text)
  ].join(' ').toLowerCase()
}

function rank(query) {
  const queryTokens = [...new Set(tokenize(query))]
  return apiCorpus.map(entry => ({
    id: entry.id,
    score: queryTokens.filter(token => searchableText(entry).includes(token)).length / queryTokens.length
  })).sort((a, b) => b.score - a.score)
}

test('generated corpus artifacts agree', () => {
  assert.equal(index.entry_count, apiCorpus.length)
  assert.deepEqual(apiCorpus, webCorpus)
  assert.deepEqual(index.entries.map(entry => entry.id), apiCorpus.map(entry => entry.id))
  assert.match(index.corpus_revision, /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual(memoryCards.map(card => card.id), apiCorpus.map(entry => entry.id))
})

test('every memory card is self-contained and under 150 approximate tokens', () => {
  for (const card of memoryCards) {
    assert.ok(card.anti_pattern)
    assert.ok(card.verification)
    assert.match(card.canonical_url, new RegExp(`/af/${card.id}$`))
    assert.equal(card.corpus_revision, index.corpus_revision)
    assert.equal(card.authority, 'none')
    assert.ok(Math.ceil(JSON.stringify(card).length / 4) <= 150, `${card.id} memory card exceeds 150 approximate tokens`)
  }
})

test('stable IDs, canonical URLs, and retrieval records are unique', () => {
  const ids = apiCorpus.map(entry => entry.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const entry of apiCorpus) {
    assert.match(entry.id, /^AF-\d{4}$/)
    assert.equal(entry.canonical_url, `https://agentfables.org/af/${entry.id}`)
    assert.ok(fs.existsSync(path.join(root, 'signatures', `${entry.id.toLowerCase()}.md`)))
  }
})

test('thematic leaders are bounded, revision-pinned, and route only to known records', () => {
  const known = new Set(apiCorpus.map(entry => entry.id))
  assert.equal(leaders.authority, 'none')
  assert.equal(leaders.corpus_revision, index.corpus_revision)
  assert.equal(leaders.ranking_status, 'unverified-until-publication')
  assert.equal(leaders.volume_claim, 'unmeasured-problem-vocabulary')
  assert.equal(leaders.topics.length, 8)
  for (const topic of leaders.topics) {
    assert.ok(topic.records.length >= 2)
    assert.ok(topic.search_terms.length >= 4)
    assert.ok(topic.records.every(record => known.has(record.id)))
    assert.ok(fs.existsSync(path.join(root, 'leaders', `${topic.slug}.md`)))
  }
})

test('portable skill is trigger-rich, compact, and preserves non-authorization', () => {
  const skill = fs.readFileSync(path.join(root, 'skills', 'agent-fables-preflight', 'SKILL.md'), 'utf8')
  assert.match(skill, /destructive, irreversible, privileged/)
  assert.match(skill, /authority: none/)
  assert.match(skill, /absence of a match is not evidence of safety/)
  assert.match(skill, /assess --stdin/)
  assert.ok(Math.ceil(skill.length / 4) <= 700)
})

test('low-capability bootstrap is self-contained, bounded, and corpus-pinned', () => {
  const start = fs.readFileSync(path.join(root, 'START_HERE.md'), 'utf8')
  assert.equal(agentEntry.authority, 'none')
  assert.equal(agentEntry.authorization, 'not-granted')
  assert.equal(agentEntry.no_match_means_safe, false)
  assert.equal(agentEntry.corpus_revision, index.corpus_revision)
  assert.equal(agentEntry.counts.patterns, index.entry_count)
  assert.equal(agentEntry.counts.incidents, index.incident_count)
  assert.match(agentEntry.repository_contents.instruction, /repository-contents connector/)
  assert.match(start, /raw\.githubusercontent\.com/)
  assert.match(start, /No match does not mean an action is safe/)
  assert.ok(Math.ceil(start.length / 4) <= 550, 'START_HERE.md exceeds 550 approximate tokens')
  assert.ok(Math.ceil(JSON.stringify(agentEntry).length / 4) <= 600, 'agent-entry.json exceeds 600 approximate tokens')
})

test('standalone sandbox runtime works without checkout, dependencies, or network', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fables-sandbox-'))
  const standalone = path.join(temporary, 'agent-fables-sandbox.mjs')
  try {
    fs.copyFileSync(path.join(root, 'sandbox', 'agent-fables-sandbox.mjs'), standalone)
    const status = spawnSync(process.execPath, [standalone, 'status'], { cwd: temporary, encoding: 'utf8', env: {} })
    assert.equal(status.status, 0, status.stderr)
    const statusJson = JSON.parse(status.stdout)
    assert.equal(statusJson.corpus_revision, index.corpus_revision)
    assert.equal(statusJson.patterns, index.entry_count)
    assert.equal(statusJson.dependencies, 0)
    assert.equal(statusJson.network_required, false)

    const assessment = spawnSync(process.execPath, [standalone, 'assess', '--stdin'], {
      cwd: temporary, encoding: 'utf8', env: {},
      input: JSON.stringify({ operation: 'force-push', stack: 'git', target_scope: 'shared branch', irreversible: true })
    })
    assert.equal(assessment.status, 0, assessment.stderr)
    const receipt = JSON.parse(assessment.stdout)
    assert.equal(receipt.authorized, false)
    assert.equal(receipt.receipt.authorization, 'not-granted')
    assert.equal(receipt.receipt.absence_of_match_means_safe, false)
    assert.ok(receipt.receipt.matched_ids.length > 0)
  } finally {
    fs.rmSync(temporary, { recursive: true })
  }
})

test('public evidence coverage and false-safety eval are revision-pinned', () => {
  assert.equal(evidenceCoverage.corpus_revision, index.corpus_revision)
  assert.equal(evidenceCoverage.overall.primary_source_incident_coverage, 1)
  assert.equal(evidenceCoverage.patterns.length, index.entry_count)
  const evaluation = spawnSync(process.execPath, [path.join(root, 'sandbox', 'agent-fables-sandbox.mjs'), 'eval'], { encoding: 'utf8', env: {} })
  assert.equal(evaluation.status, 0, evaluation.stderr)
  const report = JSON.parse(evaluation.stdout)
  assert.equal(report.corpus_revision, index.corpus_revision)
  assert.equal(report.false_safety.pass_rate, 1)
  assert.ok(report.false_safety.fixtures >= 8)
  assert.equal(report.negative_controls.false_positive_rate, 0)
  const metrics = JSON.parse(fs.readFileSync(path.join(root, 'metrics-report.json'), 'utf8'))
  assert.equal(metrics.corpus_revision, index.corpus_revision)
  assert.equal(metrics.discovery.recall_at_1, 1)
  assert.equal(metrics.discovery.adversarial_recall_at_1, 1)
  assert.match(metrics.evaluation_contract.discovery_set.sha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(metrics.evaluation_contract.adversarial_set.sha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(metrics.evaluation_contract.false_safety_set.sha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(metrics.evaluation_contract.negative_control_set.sha256, /^sha256:[a-f0-9]{64}$/)
})

test('consumer contract and host policy cannot convert evidence into authorization', async () => {
  assert.equal(consumerObligations.authority, 'none')
  assert.equal(consumerObligations.receipt_is_authorization, false)
  assert.equal(consumerObligations.host_acknowledgement.required_value, 'agent-fables-consumer-obligations@1.0.0')
  const { evaluateAgentFablesReceipt } = await import('../integrations/host-preflight-policy.mjs')
  const decision = evaluateAgentFablesReceipt({ authority: 'none', authorized: false, risk_flags: [], required_verifications: [], receipt: { authorization: 'not-granted', absence_of_match_means_safe: false } })
  assert.equal(decision.allow, false)
  assert.equal(decision.reason, 'agent-fables-never-authorizes')
  assert.ok(fs.readFileSync(path.join(root, 'integrations', 'host-preflight-policy.mjs'), 'utf8').split('\n').length < 50)
})

test('confirmation denominators are derived from stable incident identities', () => {
  const knownIncidents = new Set(incidentIndex.incidents.map(incident => incident.id))
  assert.equal(incidentIndex.incident_count, knownIncidents.size)
  assert.equal(index.incident_count, knownIncidents.size)
  for (const entry of apiCorpus) {
    assert.equal(entry.confirmations, entry.incidents.length, `${entry.id} confirmation count drifted`)
    assert.equal(new Set(entry.incidents).size, entry.incidents.length, `${entry.id} repeats an incident`)
    assert.ok(entry.incidents.every(id => knownIncidents.has(id)), `${entry.id} references an unknown incident`)
    assert.equal(entry.source_count, entry.provenance.length, `${entry.id} source count drifted`)
    assert.equal(entry.primary_source_count, entry.provenance.filter(source => source.authority === 'primary').length)
    assert.match(entry.evidence_grade, /^[ABC]-/)
    assert.equal(entry.evidence_status, 'event-normalized')
  }
  assert.deepEqual(apiCorpus.find(entry => entry.id === 'AF-0001').incidents, ['AFI-0001'])
  assert.deepEqual(apiCorpus.find(entry => entry.id === 'AF-0007').incidents, ['AFI-0001'])
})

test('primary-source coverage is visible and secondary-only evidence cannot masquerade as grade A', () => {
  const primaryIncidents = incidentIndex.incidents.filter(incident => incident.evidence_grade === 'A-primary-source')
  assert.equal(primaryIncidents.length, incidentIndex.incidents.length)
  for (const incident of incidentIndex.incidents) {
    const primaryCount = incident.sources.filter(source => source.authority === 'primary').length
    assert.equal(incident.primary_source_count, primaryCount)
    assert.equal(incident.evidence_grade === 'A-primary-source', primaryCount > 0)
  }
})

test('trust manifest is tied to this corpus and cannot overstate disabled capabilities', () => {
  assert.equal(trust.corpus_revision, index.corpus_revision)
  assert.equal(trust.counts.patterns, index.entry_count)
  assert.equal(trust.counts.incidents, index.incident_count)
  assert.equal(trust.invariants.report_storage_enabled, false)
  assert.equal(trust.invariants.exact_signatures_require_text_hashes, true)
  assert.equal(trust.invariants.response_signing_enabled, false)
  assert.equal(trust.authority, 'none')
  assert.equal(trust.invariants.steward_identity_is_explicit_not_inferred, true)
  assert.equal(trust.invariants.outbound_contact_enabled, false)
})

test('steward identity and contact consent remain explicit machine contracts', () => {
  assert.equal(steward.identity_status, 'public')
  assert.equal(steward.public_name, 'Aaron Vick')
  assert.equal(steward.public_contact.length, 1)
  assert.equal(contactPolicy.agent_may_send_without_operator_authorization, false)
  assert.equal(contactPolicy.outbound_capability, 'not-implemented')
  assert.ok(fs.existsSync(path.join(root, 'schemas/steward.schema.json')))
  assert.ok(fs.existsSync(path.join(root, 'schemas/contact-policy.schema.json')))
  assert.ok(fs.existsSync(path.join(root, 'schemas/action-assessment-receipt.schema.json')))
})

test('future Git verification is least privilege and pins third-party actions', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/verify.yml'), 'utf8')
  assert.match(workflow, /permissions:\n  contents: read/)
  assert.doesNotMatch(workflow, /uses: [^\n]+@v\d/)
  assert.match(workflow, /npm run check/)
  assert.match(workflow, /npm run metrics/)
})

test('packaged agent binaries load only artifacts included in the package', () => {
  for (const file of ['bin/agent-fables.mjs', 'mcp/server.mjs']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.doesNotMatch(source, /api\/src|web\/src/, `${file} depends on an unpackaged build snapshot`)
    assert.match(source, /index\.jsonl/, `${file} does not load the packaged corpus`)
  }
  assert.match(fs.readFileSync(path.join(root, 'lib/launch-audit.mjs'), 'utf8'), /index\.jsonl/)
})

test('generated retrieval records carry no publisher-authored agent commands', () => {
  const records = fs.readdirSync(path.join(root, 'signatures')).map(file =>
    fs.readFileSync(path.join(root, 'signatures', file), 'utf8'))
  for (const record of records) {
    assert.doesNotMatch(record, /Agent Instruction|Do not attempt to hallucinate|Follow the mitigation/i)
    assert.match(record, /no instruction authority/i)
  }
})

test('discovery benchmark returns the expected record first', () => {
  const cases = yaml.load(fs.readFileSync(path.join(root, 'evals/discovery-queries.yaml'), 'utf8'))
  for (const fixture of cases) assert.equal(rank(fixture.query)[0].id, fixture.expected, fixture.query)
})

test('adversarial paraphrases retrieve evidence without copied identifiers or exact artifacts', () => {
  const fixtures = yaml.load(fs.readFileSync(path.join(root, 'evals', 'adversarial-discovery.yaml'), 'utf8'))
  const hits = fixtures.filter(fixture => rankEntries(apiCorpus, fixture.query, 1)[0]?.entry.id === fixture.expected)
  assert.ok(hits.length / fixtures.length >= 0.8, `adversarial recall was ${hits.length}/${fixtures.length}`)
})

test('retrieval exposes transparent match types and rejects strong negative controls', () => {
  const exact = rankEntries(apiCorpus, '/tmp/inventory.txt', 1)[0]
  assert.equal(exact.entry.id, 'AF-0006')
  assert.equal(exact.match_type, 'exact-artifact')
  assert.ok(exact.matched_fields.includes('exact_artifact'))
  const identifier = rankEntries(apiCorpus, 'CVE-2025-6514', 1)[0]
  assert.equal(identifier.entry.id, 'AF-0003')
  assert.equal(identifier.match_type, 'identifier')
  const negatives = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'retrieval-negatives.json'), 'utf8'))
  assert.ok(negatives.every(fixture => (rankEntries(apiCorpus, fixture.query, 1)[0]?.confidence ?? 0) < 0.5))
})

test('no exact signature is published without structured source evidence', () => {
  for (const entry of apiCorpus) {
    for (const signature of entry.exact_signatures) {
      assert.equal(typeof signature, 'object', `${entry.id} exact signatures must be structured`)
      assert.ok(signature.text)
      assert.match(signature.source, /^https:\/\//)
      assert.equal(signature.text_sha256, `sha256:${crypto.createHash('sha256').update(signature.text).digest('hex')}`)
      assert.ok(signature.kind)
    }
  }
})

test('investigated exact-artifact gaps remain explicit and cannot masquerade as signatures', () => {
  const reviewed = index.entries.filter(entry => entry.exact_signature_review?.status === 'investigated-no-stable-artifact')
  assert.deepEqual(reviewed.map(entry => entry.id), ['AF-0007'])
  assert.ok(reviewed.every(entry => entry.exact_signatures.length === 0 && entry.exact_signature_review.sources.length > 0))
})
