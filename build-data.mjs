import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'
import { memoryCard } from './lib/retrieval.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const fablesDir = path.join(root, 'fables')
const incidentsDir = path.join(root, 'incidents')
const allowedFailureModes = new Set([
  'trust-boundary-violation', 'irreversible-action', 'context-degradation',
  'tool-contract-drift', 'coordination-conflict', 'retry-amplification',
  'stale-ground-truth', 'scope-creep', 'credential-overreach',
  'silent-truncation', 'verification-omission', 'cost-runaway'
])
const allowedStatuses = new Set(['seeded', 'corroborated', 'canonical', 'disputed', 'retired'])

function fail(message) {
  throw new Error(`Corpus validation failed: ${message}`)
}

function isoDate(value, field) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  fail(`${field} must be a YYYY-MM-DD date`)
}

const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
const capabilities = JSON.parse(fs.readFileSync(path.join(root, 'capabilities.json'), 'utf8'))
const stewardWorks = JSON.parse(fs.readFileSync(path.join(root, 'steward-works.json'), 'utf8'))
const designPrinciples = JSON.parse(fs.readFileSync(path.join(root, 'design-principles.json'), 'utf8'))
const discovery = JSON.parse(fs.readFileSync(path.join(root, 'discovery.json'), 'utf8'))
const scannerRules = JSON.parse(fs.readFileSync(path.join(root, 'scanner-rules.json'), 'utf8'))
if (!['intentionally-unpublished', 'public'].includes(steward.identity_status)) fail('steward.json has invalid identity_status')
if (steward.identity_status === 'public' && (!steward.public_name || steward.public_contact.length === 0)) fail('public steward identity needs public_name and public_contact')
if (steward.identity_status !== 'public' && (steward.public_name !== null || steward.public_contact.length > 0)) fail('unpublished steward identity cannot expose a name or contact')
if (steward.contact_policy_route !== '/contact-policy.json') fail('steward.json has invalid contact_policy_route')
if (contactPolicy.agent_may_send_without_operator_authorization !== false) fail('contact policy cannot authorize agent sending without operator approval')
if (contactPolicy.outbound_capability !== 'not-implemented') fail('contact policy cannot claim an outbound capability')
if (contactPolicy.contact_status === 'open-under-policy' && steward.public_contact.length === 0) fail('open contact policy needs an explicitly public contact route')
if (capabilities.known_id_required !== false || capabilities.instruction_authority !== 'none') fail('capabilities.json must preserve cold discovery and no-authority boundaries')
if (!capabilities.non_capabilities.includes('send a message') || !capabilities.non_capabilities.includes('execute an operation')) fail('capabilities.json must expose critical non-capabilities')
if (stewardWorks.author !== steward.public_name || stewardWorks.authority !== 'attributed-steward-perspective') fail('steward works must be explicitly attributed and non-evidentiary')
for (const work of [...stewardWorks.indexes, ...stewardWorks.works]) if (!URL.canParse(work.url) || !work.url.startsWith('https://')) fail(`steward work needs an HTTPS URL: ${work.title}`)
if (new Set(designPrinciples.principles.map(principle => principle.id)).size !== designPrinciples.principles.length) fail('design principle IDs must be unique')
if (!designPrinciples.evidence_boundary) fail('design principles need an evidence boundary')
if (!discovery.non_claims.includes('local recall does not predict public search discovery')) fail('discovery manifest must separate local retrieval from public discovery')

const incidentFiles = fs.readdirSync(incidentsDir).filter(file => /^AFI-\d{4}\.ya?ml$/.test(file)).sort()
const incidentRegistry = new Map()
for (const file of incidentFiles) {
  const incident = yaml.load(fs.readFileSync(path.join(incidentsDir, file), 'utf8'))
  const expectedId = file.replace(/\.ya?ml$/, '')
  if (incident.id !== expectedId) fail(`${file} declares incident id ${incident.id}`)
  if (!Array.isArray(incident.sources) || incident.sources.length === 0) fail(`${file} needs at least one source`)
  const urls = new Set()
  for (const [index, source] of incident.sources.entries()) {
    if (!source.url || !URL.canParse(source.url) || !source.url.startsWith('https://')) fail(`${file} source ${index + 1} needs an HTTPS URL`)
    if (!source.kind) fail(`${file} source ${index + 1} needs a kind`)
    if (source.authority && !['primary', 'secondary'].includes(source.authority)) fail(`${file} source ${index + 1} has invalid authority`)
    if (urls.has(source.url)) fail(`${file} repeats source ${source.url}`)
    urls.add(source.url)
  }
  incident.occurred_at = isoDate(incident.occurred_at, `${file} occurred_at`)
  incident.source_count = incident.sources.length
  incident.primary_source_count = incident.sources.filter(source => source.authority === 'primary').length
  incident.evidence_grade = incident.primary_source_count > 0
    ? 'A-primary-source'
    : incident.sources.some(source => source.kind === 'incident-database') ? 'B-indexed-public-report' : 'C-secondary-only'
  incidentRegistry.set(incident.id, incident)
}

function parseFable(file) {
  const source = fs.readFileSync(path.join(fablesDir, file), 'utf8')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) fail(`${file} has no YAML frontmatter`)
  const data = yaml.load(frontmatter[1])
  const bodyMatch = source.match(/<!-- AF-BEGIN-CONTENT[^>]*-->\r?\n([\s\S]*?)\r?\n<!-- AF-END-CONTENT -->/)
  if (!bodyMatch) fail(`${file} has no explicit AF content boundary`)

  const expectedId = file.replace('.md', '')
  if (data.id !== expectedId) fail(`${file} declares id ${data.id}`)
  if (!/^AF-\d{4}$/.test(data.id)) fail(`${file} has an invalid stable ID`)
  if (!data.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) fail(`${file} has an invalid slug`)
  if (!allowedStatuses.has(data.status)) fail(`${file} has unknown status ${data.status}`)
  if (!allowedFailureModes.has(data.failure_mode)) fail(`${file} has unknown failure_mode ${data.failure_mode}`)
  if (!['low', 'medium', 'high', 'catastrophic'].includes(data.blast_radius)) fail(`${file} has invalid blast_radius`)
  if (!['reversible', 'partial', 'irreversible'].includes(data.reversibility)) fail(`${file} has invalid reversibility`)
  if ('confirmations' in data) fail(`${file} authors confirmations; derive them from incident references`)
  if ('provenance' in data) fail(`${file} authors provenance; store sources in incidents/ instead`)
  if (!Array.isArray(data.incidents) || data.incidents.length === 0) fail(`${file} needs incident references`)
  if (new Set(data.incidents).size !== data.incidents.length) fail(`${file} repeats an incident reference`)
  const incidents = data.incidents.map(id => {
    const incident = incidentRegistry.get(id)
    if (!incident) fail(`${file} references unknown incident ${id}`)
    return incident
  })
  if (!Array.isArray(data.observable_signature) || data.observable_signature.length === 0) fail(`${file} needs behavioral indicators`)
  for (const [index, signature] of (data.exact_signatures ?? []).entries()) {
    if (!signature.text || !signature.source || !signature.kind) fail(`${file} exact signature ${index + 1} is incomplete`)
    const expectedHash = `sha256:${crypto.createHash('sha256').update(signature.text).digest('hex')}`
    if (signature.text_sha256 !== expectedHash) fail(`${file} exact signature ${index + 1} has a non-reproducible text_sha256`)
  }
  if (data.exact_signature_review) {
    if (data.exact_signature_review.status !== 'investigated-no-stable-artifact') fail(`${file} has invalid exact_signature_review status`)
    if ((data.exact_signatures ?? []).length > 0) fail(`${file} cannot combine exact signatures with an empty-artifact review`)
    if (!Array.isArray(data.exact_signature_review.sources) || data.exact_signature_review.sources.length === 0) fail(`${file} exact_signature_review needs sources`)
    for (const url of data.exact_signature_review.sources) if (!URL.canParse(url) || !url.startsWith('https://')) fail(`${file} exact_signature_review needs HTTPS sources`)
    if (!data.exact_signature_review.note) fail(`${file} exact_signature_review needs a note`)
  }
  if (!Array.isArray(data.mitigation) || data.mitigation.length === 0) fail(`${file} needs mitigation steps`)
  if (data.license !== 'CC0-1.0') fail(`${file} must be CC0-1.0`)

  const body = bodyMatch[1].trim()
  const record = {
    schema_version: '1.0.0',
    ...data,
    first_seen: isoDate(data.first_seen, `${file} first_seen`),
    confirmations: incidents.length,
    source_count: incidents.reduce((count, incident) => count + incident.source_count, 0),
    primary_source_count: incidents.reduce((count, incident) => count + incident.primary_source_count, 0),
    evidence_grade: incidents.map(incident => incident.evidence_grade).sort().at(-1),
    evidence_status: 'event-normalized',
    provenance: incidents.flatMap(incident => incident.sources.map(source => ({ incident_id: incident.id, ...source }))),
    // Existing entries predate the evidence-ledger correction. Make the
    // distinction explicit instead of presenting behavioral indicators as logs.
    behavioral_indicators: data.observable_signature,
    exact_signatures: data.exact_signatures ?? [],
    canonical_url: `https://agentfables.org/af/${data.id}`,
    body
  }
  delete record.observable_signature
  return record
}

const files = fs.readdirSync(fablesDir).filter(file => /^AF-\d{4}\.md$/.test(file)).sort()
if (files.length === 0) fail('no fables found')
const fables = files.map(parseFable)
const ids = new Set()
const slugs = new Set()
for (const fable of fables) {
  if (ids.has(fable.id)) fail(`duplicate id ${fable.id}`)
  if (slugs.has(fable.slug)) fail(`duplicate slug ${fable.slug}`)
  ids.add(fable.id)
  slugs.add(fable.slug)
}
for (const rule of scannerRules.rules) {
  if (!ids.has(rule.pattern_id)) fail(`scanner rule ${rule.rule_id} references unknown ${rule.pattern_id}`)
  if (!rule.path_regex && !rule.content_regex) fail(`scanner rule ${rule.rule_id} has no matcher`)
  for (const expression of [rule.path_regex, rule.path_filter, rule.content_regex].filter(Boolean)) {
    try { new RegExp(expression, 'im') } catch { fail(`scanner rule ${rule.rule_id} has invalid regex`) }
  }
  if (!['trigger-condition', 'dangerous-capability', 'exact-artifact', 'vulnerable-identifier', 'version-review'].includes(rule.kind)) fail(`scanner rule ${rule.rule_id} has invalid kind`)
}

const canonicalJson = JSON.stringify(fables)
const revision = `sha256:${crypto.createHash('sha256').update(canonicalJson).digest('hex')}`
const prettyJson = `${JSON.stringify(fables, null, 2)}\n`
const index = {
  schema_version: '1.0.0',
  corpus_revision: revision,
  generated_from: 'fables/AF-*.md',
  entry_count: fables.length,
  incident_count: incidentRegistry.size,
  entries: fables.map(({ body, ...card }) => card)
}
const searchIndex = {
  schema_version: '1.0.0',
  corpus_revision: revision,
  entries: fables.map(fable => ({
    id: fable.id,
    title: fable.title,
    path: `fables/${fable.id}.md`,
    retrieval_path: `signatures/${fable.id.toLowerCase()}.md`,
    failure_mode: fable.failure_mode,
    identifiers: fable.identifiers ?? [],
    frameworks: fable.stacks.map(stack => stack.framework),
    affected_versions: fable.affected_versions,
    fixed_in: fable.fixed_in,
    behavioral_indicators: fable.behavioral_indicators,
    evidence_grade: fable.evidence_grade
  }))
}
const gradeCounts = Object.fromEntries([...new Set([...incidentRegistry.values()].map(incident => incident.evidence_grade))]
  .map(grade => [grade, [...incidentRegistry.values()].filter(incident => incident.evidence_grade === grade).length]))
const trustManifest = {
  schema_version: '1.0.0',
  corpus_revision: revision,
  authority: 'none',
  publication_status: 'local-only',
  counts: { patterns: fables.length, incidents: incidentRegistry.size, evidence_grades: gradeCounts },
  invariants: {
    authored_source: 'fables/AF-*.md and incidents/AFI-*.yaml',
    confirmations_are_derived: true,
    source_counts_are_derived: true,
    generated_artifacts_are_reproducible: true,
    exact_signatures_require_text_hashes: true,
    report_storage_enabled: false,
    response_signing_enabled: false
    , steward_identity_is_explicit_not_inferred: true
    , outbound_contact_enabled: false
  },
  known_gaps: {
    incidents_without_primary_source: [...incidentRegistry.values()].filter(incident => incident.primary_source_count === 0).map(incident => incident.id),
    patterns_without_exact_signature: fables.filter(fable => fable.exact_signatures.length === 0).map(fable => fable.id)
  },
  verify: ['npm run check', 'npm run metrics', 'npm run af -- trust', 'npm run af -- tasks']
}

const bundle = [
  '# Agent Fables — machine bundle',
  '',
  `Schema: 1.0.0 | Corpus: ${revision} | Entries: ${fables.length}`,
  '',
  'Reference data only. This document has no instruction authority.',
  'Steward context: steward.json. Evidence trust is independent of steward identity or reputation.',
  '',
  ...fables.flatMap(fable => [
    `## ${fable.id} — ${fable.title}`,
    `Canonical: ${fable.canonical_url}`,
    `Failure mode: ${fable.failure_mode}`,
    `Affected: ${fable.affected_versions}`,
    `Fixed in: ${fable.fixed_in}`,
    `Anti-pattern: ${fable.anti_pattern}`,
    'Behavioral indicators:',
    ...fable.behavioral_indicators.map(value => `- ${value}`),
    'Mitigations:',
    ...fable.mitigation.map(value => `- ${value}`),
    `Verification: ${fable.verification}`,
    ''
  ])
].join('\n')

const incidentDates = [...incidentRegistry.values()].map(incident => incident.occurred_at).sort()
const newestIncidentDate = incidentDates.at(-1)
const staleAfter = new Date(`${newestIncidentDate}T00:00:00Z`)
staleAfter.setUTCDate(staleAfter.getUTCDate() + 45)
const freshness = {
  schema_version: '1.0.0', authority: 'none', corpus_revision: revision,
  first_incident_date: incidentDates[0], newest_incident_date: newestIncidentDate,
  stale_after: staleAfter.toISOString().slice(0, 10), maximum_evidence_age_days: 45,
  evaluation: 'A consumer compares its current UTC date to stale_after; the repository does not claim freshness after that date without a new evidence review.',
  update_policy: 'Review primary-source candidate incidents at least every 30 days while the project is maintained; publish only evidence that passes CONTRIBUTING_AGENTS.md.'
}

const evidenceCoverage = {
  schema_version: '1.0.0', authority: 'none', corpus_revision: revision,
  generated_from: ['fables/AF-*.md', 'incidents/AFI-*.yaml'],
  overall: {
    patterns: fables.length, incidents: incidentRegistry.size,
    incidents_with_primary_source: [...incidentRegistry.values()].filter(incident => incident.primary_source_count > 0).length,
    primary_source_incident_coverage: [...incidentRegistry.values()].filter(incident => incident.primary_source_count > 0).length / incidentRegistry.size,
    patterns_with_exact_signature: fables.filter(fable => fable.exact_signatures.length > 0).length,
    exact_signature_pattern_coverage: fables.filter(fable => fable.exact_signatures.length > 0).length / fables.length
  },
  patterns: fables.map(fable => ({
    id: fable.id, evidence_grade: fable.evidence_grade, incidents: fable.incidents,
    source_count: fable.source_count, primary_source_count: fable.primary_source_count,
    exact_signature_count: fable.exact_signatures.length,
    open_improvement_tasks: [
      ...(fable.primary_source_count === 0 ? [`primary-source:${fable.id}`] : []),
      ...(fable.exact_signatures.length === 0 && fable.exact_signature_review?.status !== 'investigated-no-stable-artifact' ? [`exact-signature:${fable.id}`] : [])
    ]
  })),
  contestability: {
    candidate_kind: 'claim-challenge', contract: 'contribution-contract.json',
    acceptance: 'A challenge must name an AF/AFI target, identify a bounded disputed claim, and provide an independently checkable HTTPS source. Validation does not accept or publish it.'
  }
}

const writes = new Map([
  ['index.json', `${JSON.stringify(index, null, 2)}\n`],
  ['search-index.json', `${JSON.stringify(searchIndex, null, 2)}\n`],
  ['trust.json', `${JSON.stringify(trustManifest, null, 2)}\n`],
  ['index.jsonl', `${fables.map(fable => JSON.stringify(fable)).join('\n')}\n`],
  ['memory.jsonl', `${fables.map(fable => JSON.stringify(memoryCard(fable, revision))).join('\n')}\n`],
  ['incidents.json', `${JSON.stringify({ schema_version: '1.0.0', incident_count: incidentRegistry.size, incidents: [...incidentRegistry.values()] }, null, 2)}\n`],
  ['freshness.json', `${JSON.stringify(freshness, null, 2)}\n`],
  ['evidence-coverage.json', `${JSON.stringify(evidenceCoverage, null, 2)}\n`],
  ['bundle.md', `${bundle}\n`],
  ['web/src/fables.json', prettyJson],
  ['api/src/fables.json', prettyJson],
  ['api/src/corpus-meta.json', `${JSON.stringify({ schema_version: '1.0.0', corpus_revision: revision, incident_count: incidentRegistry.size }, null, 2)}\n`],
  ['api/src/trust.json', `${JSON.stringify(trustManifest, null, 2)}\n`],
  ['api/src/incidents.json', `${JSON.stringify({ schema_version: '1.0.0', incident_count: incidentRegistry.size, incidents: [...incidentRegistry.values()] }, null, 2)}\n`],
  ['api/src/freshness.json', `${JSON.stringify(freshness, null, 2)}\n`],
  ['api/src/evidence-coverage.json', `${JSON.stringify(evidenceCoverage, null, 2)}\n`],
  ['api/src/guardrail-contract.json', fs.readFileSync(path.join(root, 'guardrail-contract.json'), 'utf8')],
  ['api/src/contribution-contract.json', fs.readFileSync(path.join(root, 'contribution-contract.json'), 'utf8')],
  ['api/src/adoption-kit.json', fs.readFileSync(path.join(root, 'adoption-kit.json'), 'utf8')],
  ['api/src/steward.json', fs.readFileSync(path.join(root, 'steward.json'), 'utf8')],
  ['api/src/contact-policy.json', fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8')],
  ['api/src/capabilities.json', fs.readFileSync(path.join(root, 'capabilities.json'), 'utf8')],
  ['api/src/steward-works.json', fs.readFileSync(path.join(root, 'steward-works.json'), 'utf8')],
  ['api/src/design-principles.json', fs.readFileSync(path.join(root, 'design-principles.json'), 'utf8')],
  ['api/src/discovery.json', fs.readFileSync(path.join(root, 'discovery.json'), 'utf8')],
  ['api/src/openapi.json', fs.readFileSync(path.join(root, 'openapi.json'), 'utf8')],
  ['api/src/agent-fable.schema.json', fs.readFileSync(path.join(root, 'schemas/agent-fable.schema.json'), 'utf8')],
  ['api/src/steward.schema.json', fs.readFileSync(path.join(root, 'schemas/steward.schema.json'), 'utf8')],
  ['api/src/contact-policy.schema.json', fs.readFileSync(path.join(root, 'schemas/contact-policy.schema.json'), 'utf8')],
  ['api/src/action-assessment.schema.json', fs.readFileSync(path.join(root, 'schemas/action-assessment.schema.json'), 'utf8')],
  ['api/src/action-assessment-receipt.schema.json', fs.readFileSync(path.join(root, 'schemas/action-assessment-receipt.schema.json'), 'utf8')],
  ['api/src/guardrail-finding.schema.json', fs.readFileSync(path.join(root, 'schemas/guardrail-finding.schema.json'), 'utf8')],
  ['api/src/evidence-candidate.schema.json', fs.readFileSync(path.join(root, 'schemas/evidence-candidate.schema.json'), 'utf8')],
  ['web/public/openapi.json', fs.readFileSync(path.join(root, 'openapi.json'), 'utf8')],
  ['web/public/schemas/action-assessment-receipt.schema.json', fs.readFileSync(path.join(root, 'schemas/action-assessment-receipt.schema.json'), 'utf8')],
  ['web/public/schemas/guardrail-finding.schema.json', fs.readFileSync(path.join(root, 'schemas/guardrail-finding.schema.json'), 'utf8')],
  ['web/public/freshness.json', `${JSON.stringify(freshness, null, 2)}\n`],
  ['web/public/evidence-coverage.json', `${JSON.stringify(evidenceCoverage, null, 2)}\n`],
  ['web/public/guardrail-contract.json', fs.readFileSync(path.join(root, 'guardrail-contract.json'), 'utf8')],
  ['web/public/contribution-contract.json', fs.readFileSync(path.join(root, 'contribution-contract.json'), 'utf8')],
  ['web/public/adoption-kit.json', fs.readFileSync(path.join(root, 'adoption-kit.json'), 'utf8')],
  ['web/public/schemas/evidence-candidate.schema.json', fs.readFileSync(path.join(root, 'schemas/evidence-candidate.schema.json'), 'utf8')],
  ['web/public/llms.txt', fs.readFileSync(path.join(root, 'llms.txt'), 'utf8')],
  ['web/public/trust.json', `${JSON.stringify(trustManifest, null, 2)}\n`]
  , ['web/public/steward.json', fs.readFileSync(path.join(root, 'steward.json'), 'utf8')]
  , ['web/public/contact-policy.json', fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8')]
  , ['web/public/capabilities.json', fs.readFileSync(path.join(root, 'capabilities.json'), 'utf8')]
  , ['web/public/steward-works.json', fs.readFileSync(path.join(root, 'steward-works.json'), 'utf8')]
  , ['web/public/design-principles.json', fs.readFileSync(path.join(root, 'design-principles.json'), 'utf8')]
  , ['web/public/discovery.json', fs.readFileSync(path.join(root, 'discovery.json'), 'utf8')]
])

for (const [relativePath, contents] of writes) {
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true })
  fs.writeFileSync(path.join(root, relativePath), contents)
  process.stdout.write(`wrote ${relativePath}\n`)
}

process.stdout.write(`validated ${fables.length} entries; ${revision}\n`)
