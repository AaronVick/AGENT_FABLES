import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { memoryCard } from './retrieval.mjs'

const sha256 = value => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`

export function verifyInstallation(root) {
  const required = ['index.json', 'index.jsonl', 'memory.jsonl', 'incidents.json', 'trust.json', 'capabilities.json', 'steward.json', 'contact-policy.json', 'leaders.json', 'freshness.json', 'guardrail-contract.json', 'contribution-contract.json', 'adoption-kit.json', 'publication-state.json', 'schemas/guardrail-finding.schema.json', 'schemas/evidence-candidate.schema.json']
  const missing = required.filter(file => !fs.existsSync(path.join(root, file)))
  if (missing.length) return { route: 'offline-verify', verified: false, missing, checks: {} }

  const corpus = fs.readFileSync(path.join(root, 'index.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
  const incidents = JSON.parse(fs.readFileSync(path.join(root, 'incidents.json'), 'utf8'))
  const trust = JSON.parse(fs.readFileSync(path.join(root, 'trust.json'), 'utf8'))
  const capabilities = JSON.parse(fs.readFileSync(path.join(root, 'capabilities.json'), 'utf8'))
  const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
  const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
  const leaders = JSON.parse(fs.readFileSync(path.join(root, 'leaders.json'), 'utf8'))
  const freshness = JSON.parse(fs.readFileSync(path.join(root, 'freshness.json'), 'utf8'))
  const publicationState = JSON.parse(fs.readFileSync(path.join(root, 'publication-state.json'), 'utf8'))
  const storedMemoryCards = fs.readFileSync(path.join(root, 'memory.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  const computedRevision = sha256(JSON.stringify(corpus))
  const exactArtifacts = corpus.flatMap(entry => entry.exact_signatures.map(signature => ({ pattern_id: entry.id, ...signature })))
  const invalidArtifacts = exactArtifacts.filter(signature => sha256(signature.text) !== signature.text_sha256)
  const checks = {
    corpus_revision_matches_index: computedRevision === index.corpus_revision,
    corpus_revision_matches_trust: computedRevision === trust.corpus_revision,
    entry_count_matches: corpus.length === index.entry_count && corpus.length === trust.counts.patterns,
    incident_count_matches: incidents.incident_count === index.incident_count && incidents.incident_count === trust.counts.incidents,
    exact_artifact_hashes_match: invalidArtifacts.length === 0,
    authority_is_none: trust.authority === 'none' && capabilities.instruction_authority === 'none',
    cold_discovery_supported: capabilities.known_id_required === false,
    outbound_contact_disabled: contactPolicy.agent_may_send_without_operator_authorization === false && contactPolicy.outbound_capability === 'not-implemented',
    steward_evidence_boundary_present: typeof steward.trust_boundary === 'string' && steward.trust_boundary.length > 0
    , memory_cards_match_corpus: JSON.stringify(storedMemoryCards) === JSON.stringify(corpus.map(entry => memoryCard(entry, computedRevision)))
    , memory_cards_within_budget: storedMemoryCards.every(card => Math.ceil(JSON.stringify(card).length / 4) <= 150)
    , thematic_leaders_match_corpus: leaders.authority === 'none' && leaders.corpus_revision === computedRevision && leaders.topics.every(topic =>
      topic.records.length >= 2 && topic.records.every(record => corpus.some(entry => entry.id === record.id)) && fs.existsSync(path.join(root, 'leaders', `${topic.slug}.md`)))
    , portable_agent_skill_present: fs.existsSync(path.join(root, 'skills', 'agent-fables-preflight', 'SKILL.md')) &&
      fs.readFileSync(path.join(root, 'skills', 'agent-fables-preflight', 'SKILL.md'), 'utf8').includes('absence of a match is not evidence of safety')
    , freshness_matches_corpus: freshness.authority === 'none' && freshness.corpus_revision === computedRevision &&
      freshness.newest_incident_date === incidents.incidents.map(incident => incident.occurred_at).sort().at(-1)
    , guardrail_contract_present: fs.existsSync(path.join(root, 'lib', 'finding.mjs'))
    , contribution_and_adoption_contracts_present: fs.existsSync(path.join(root, 'lib', 'candidate.mjs'))
    , public_git_state_is_explicit: publicationState.visibility === 'public' && publicationState.git_repository_published === true && publicationState.raw_machine_artifacts_verified === true
  }
  return {
    route: 'offline-verify', verified: Object.values(checks).every(Boolean),
    corpus_revision: index.corpus_revision, computed_revision: computedRevision,
    counts: { patterns: corpus.length, incidents: incidents.incident_count, exact_artifacts: exactArtifacts.length, thematic_leaders: leaders.topics.length },
    checks,
    failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    invalid_artifacts: invalidArtifacts.map(signature => ({ pattern_id: signature.pattern_id, text_sha256: signature.text_sha256 }))
  }
}
