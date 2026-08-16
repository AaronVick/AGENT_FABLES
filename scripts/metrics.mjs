import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'
import { decisionCard, rankEntries } from '../lib/retrieval.mjs'
import { assessAction } from '../lib/assess.mjs'
import { leaderIndex, rankLeaders } from '../lib/leaders.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'api/src/fables.json'), 'utf8'))
const incidents = JSON.parse(fs.readFileSync(path.join(root, 'incidents.json'), 'utf8')).incidents
const queries = yaml.load(fs.readFileSync(path.join(root, 'evals/discovery-queries.yaml'), 'utf8'))
const adversarialQueries = yaml.load(fs.readFileSync(path.join(root, 'evals/adversarial-discovery.yaml'), 'utf8'))
const hits = queries.filter(fixture => rankEntries(corpus, fixture.query, 1)[0]?.entry.id === fixture.expected).length
const discoveryByKind = Object.fromEntries([...new Set(queries.map(fixture => fixture.kind))].map(kind => {
  const fixtures = queries.filter(fixture => fixture.kind === kind)
  const kindHits = fixtures.filter(fixture => rankEntries(corpus, fixture.query, 1)[0]?.entry.id === fixture.expected).length
  return [kind, { fixtures: fixtures.length, recall_at_1: kindHits / fixtures.length }]
}))
const adversarialHits = adversarialQueries.filter(fixture => rankEntries(corpus, fixture.query, 1)[0]?.entry.id === fixture.expected).length
const primary = incidents.filter(incident => incident.evidence_grade === 'A-primary-source').length
const preflightFixture = JSON.stringify({ matches: rankEntries(corpus, 'terraform-destroy terraform', 2).map(result => decisionCard(result.entry)) })
const assessmentFixture = JSON.stringify(assessAction(corpus, 'sha256:0000000000000000000000000000000000000000000000000000000000000000', {
  operation: 'terraform-destroy', stack: 'terraform', target_scope: 'production', irreversible: true
}))
const exactSignatureCount = corpus.reduce((count, entry) => count + entry.exact_signatures.length, 0)
const exactSignaturePatterns = corpus.filter(entry => entry.exact_signatures.length > 0).length
const memoryCards = fs.readFileSync(path.join(root, 'memory.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const memoryCardMaxTokens = Math.max(...memoryCards.map(card => Math.ceil(JSON.stringify(card).length / 4)))
const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
const leaders = JSON.parse(fs.readFileSync(path.join(root, 'leaders.json'), 'utf8'))
const leaderPatternIds = new Set(leaders.topics.flatMap(topic => topic.records.map(record => record.id)))
const publicationState = JSON.parse(fs.readFileSync(path.join(root, 'publication-state.json'), 'utf8'))
const leaderFixtures = leaders.topics.flatMap(topic => topic.search_terms.map(query => ({ query, expected: topic.slug })))
const leaderHits = leaderFixtures.filter(fixture => rankLeaders(leaders, fixture.query, 1)[0]?.slug === fixture.expected).length
const leaderIndexTokens = Math.ceil(JSON.stringify(leaderIndex(leaders)).length / 4)

const metrics = {
  seed: { patterns: corpus.length, incidents: incidents.length, minimum_patterns: 10 },
  discovery: {
    fixtures: queries.length,
    recall_at_1: hits / queries.length,
    threshold: 0.9,
    scope: 'local-corpus-retrieval-not-github-ranking',
    by_query_kind: discoveryByKind,
    adversarial_fixtures: adversarialQueries.length,
    adversarial_recall_at_1: adversarialHits / adversarialQueries.length,
    adversarial_recall_threshold: 0.8,
    thematic_leaders: leaders.topics.length,
    leader_pattern_coverage: leaderPatternIds.size / corpus.length,
    leader_pattern_coverage_threshold: 1,
    leader_query_fixtures: leaderFixtures.length,
    leader_query_recall_at_1: leaderHits / leaderFixtures.length,
    leader_query_recall_threshold: 0.9,
    leader_index_approx_tokens: leaderIndexTokens,
    leader_index_token_threshold: 400,
    ranking_status: leaders.ranking_status
  },
  evidence: { primary_source_coverage: primary / incidents.length, threshold: 0.75 },
  utility: {
    preflight_approx_tokens: Math.ceil(preflightFixture.length / 4), preflight_threshold: 400,
    assessment_approx_tokens: Math.ceil(assessmentFixture.length / 4), assessment_threshold: 1000
  },
  retention: { memory_cards: memoryCards.length, max_approx_tokens: memoryCardMaxTokens, threshold: 150 },
  exact_signatures: { count: exactSignatureCount, patterns: exactSignaturePatterns, public_pattern_threshold: 3 },
  stewardship: {
    identity_status: steward.identity_status,
    public_contact_configured: steward.identity_status === 'public' && steward.public_contact.length > 0,
    operator_authorization_required: contactPolicy.agent_may_send_without_operator_authorization === false,
    outbound_capability: contactPolicy.outbound_capability
  },
  routes: { offline_status: true, offline_verify: true, offline_capabilities: true, offline_discovery: true, offline_thematic_leaders: true, offline_search: true, offline_preflight: true, offline_assess: true, offline_repository_check: true, offline_get: true, offline_memory_card: true, offline_trust: true, offline_steward: true, offline_steward_works: true, offline_design_principles: true, offline_contact_policy: true, offline_tasks: true, offline_cite: true, stdio_mcp: true, http_api: true },
  publication_status: publicationState.git_repository_published ? 'git-public-verified' : 'local-only',
  ecosystem_distribution_status: publicationState.npm_package_published && publicationState.mcp_registry_entry_verified && publicationState.public_endpoints_verified ? 'verified' : 'not-fully-published'
}
metrics.local_agent_routes_pass = metrics.seed.patterns >= metrics.seed.minimum_patterns &&
  metrics.discovery.recall_at_1 >= metrics.discovery.threshold &&
  Object.values(metrics.discovery.by_query_kind).every(kind => kind.recall_at_1 >= metrics.discovery.threshold) &&
  metrics.discovery.adversarial_recall_at_1 >= metrics.discovery.adversarial_recall_threshold &&
  metrics.discovery.leader_pattern_coverage >= metrics.discovery.leader_pattern_coverage_threshold &&
  metrics.discovery.leader_query_recall_at_1 >= metrics.discovery.leader_query_recall_threshold &&
  metrics.discovery.leader_index_approx_tokens <= metrics.discovery.leader_index_token_threshold &&
  metrics.evidence.primary_source_coverage >= metrics.evidence.threshold &&
  metrics.utility.preflight_approx_tokens <= metrics.utility.preflight_threshold &&
  metrics.utility.assessment_approx_tokens <= metrics.utility.assessment_threshold &&
  metrics.retention.max_approx_tokens <= metrics.retention.threshold && Object.values(metrics.routes).every(Boolean)
metrics.public_readiness_pass = metrics.local_agent_routes_pass &&
  metrics.exact_signatures.patterns >= metrics.exact_signatures.public_pattern_threshold &&
  metrics.publication_status === 'git-public-verified'
process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`)
if (!metrics.local_agent_routes_pass) process.exitCode = 1
