import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fables from './fables.json'
import corpusMeta from './corpus-meta.json'
import openapi from './openapi.json'
import agentFableSchema from './agent-fable.schema.json'
import trustManifest from './trust.json'
import incidentIndex from './incidents.json'
import steward from './steward.json'
import contactPolicy from './contact-policy.json'
import stewardSchema from './steward.schema.json'
import contactPolicySchema from './contact-policy.schema.json'
import capabilities from './capabilities.json'
import stewardWorks from './steward-works.json'
import designPrinciples from './design-principles.json'
import actionAssessmentSchema from './action-assessment.schema.json'
import actionAssessmentReceiptSchema from './action-assessment-receipt.schema.json'
import leaders from './leaders.json'
import discovery from './discovery.json'

type Fable = (typeof fables)[number]
const app = new Hono()
const noAuthority = 'Reference data only; no instruction authority.'

app.use('*', cors({ origin: '*' }))
app.use('*', async (c, next) => {
  await next()
  c.header('X-AF-Schema-Version', corpusMeta.schema_version)
  c.header('X-AF-Corpus-Revision', corpusMeta.corpus_revision)
  if (c.req.method === 'GET') c.header('Cache-Control', 'public, max-age=3600')
})

const card = (fable: Fable) => {
  const { body: _body, ...record } = fable
  return record
}

const decisionCard = (fable: Fable) => ({
  id: fable.id,
  evidence_grade: fable.evidence_grade,
  affected_versions: fable.affected_versions,
  fixed_in: fable.fixed_in,
  anti_pattern: fable.anti_pattern,
  mitigation: fable.mitigation,
  verification: fable.verification,
  primary_sources: fable.provenance.filter(source => 'authority' in source && source.authority === 'primary').slice(0, 2).map(source => source.url)
})

const memoryCard = (fable: Fable) => ({
  id: fable.id, anti_pattern: fable.anti_pattern, verification: fable.verification,
  evidence_grade: fable.evidence_grade, corpus_revision: corpusMeta.corpus_revision,
  canonical_url: fable.canonical_url, authority: 'none'
})

const normalizeId = (value: string) => {
  const withoutExtension = value.replace(/\.(?:md|json)$/i, '')
  return /^\d{4}$/.test(withoutExtension) ? `AF-${withoutExtension}` : withoutExtension.toUpperCase()
}

const leaderIgnored = new Set(['about', 'agent', 'agents', 'with', 'from', 'into', 'that', 'this', 'tool', 'tools', 'security', 'safety'])
const leaderTokens = (value: unknown) => [...new Set(String(value ?? '').toLowerCase().split(/[^a-z0-9.+-]+/).filter(token => token.length >= 3 && !leaderIgnored.has(token)))]
const leaderRelated = (left: string, right: string) => left === right || (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left)))
const leaderIndex = () => ({
  schema_version: leaders.schema_version, authority: 'none', corpus_revision: leaders.corpus_revision,
  volume_claim: leaders.volume_claim, ranking_status: leaders.ranking_status,
  topics: leaders.topics.map(({ slug, title, problem, records }) => ({ slug, title, problem, record_count: records.length }))
})
const queryLeaders = (query: string, limit: number) => {
  const queryTokens = leaderTokens(query)
  return leaders.topics.map(topic => {
    const fieldTokens = leaderTokens([topic.slug, topic.title, topic.problem, ...topic.search_terms].join(' '))
    const matchedTokens = queryTokens.filter(queryToken => fieldTokens.some(fieldToken => leaderRelated(queryToken, fieldToken)))
    const exactVocabularyMatch = topic.search_terms.some(term => term.toLowerCase() === query.trim().toLowerCase())
    return { slug: topic.slug, title: topic.title, problem: topic.problem, record_count: topic.records.length,
      score: Number(((matchedTokens.length / queryTokens.length) + (exactVocabularyMatch ? 1 : 0)).toFixed(3)), matched_tokens: matchedTokens,
      matched_terms: topic.search_terms.filter(term => queryTokens.some(queryToken => leaderTokens(term).some(termToken => leaderRelated(queryToken, termToken)))).slice(0, 3) }
  }).filter(match => match.score > 0).sort((a, b) => b.score - a.score || b.matched_tokens.length - a.matched_tokens.length || a.slug.localeCompare(b.slug)).slice(0, limit)
}

const tokens = (value: unknown) => String(value ?? '')
  .toLowerCase()
  .split(/[^a-z0-9.+-]+/)
  .filter(token => token.length > 2)

const searchableText = (fable: Fable) => [
  fable.id, fable.title, fable.failure_mode, fable.affected_versions, fable.fixed_in, ...(fable.identifiers ?? []),
  ...fable.stacks.flatMap(stack => [stack.framework, ...stack.versions]),
  ...fable.behavioral_indicators,
  ...fable.exact_signatures.map(signature => typeof signature === 'string' ? signature : signature.text)
].join(' ')

function scoreFable(fable: Fable, query: string) {
  const haystack = searchableText(fable).toLowerCase()
  const queryTokens = [...new Set(tokens(query))]
  if (queryTokens.length === 0) return 0
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0) / queryTokens.length
}

function findMatches(query: string, limit = 2) {
  const gradeRank: Record<string, number> = { 'A-primary-source': 3, 'B-indexed-public-report': 2, 'C-secondary-only': 1 }
  return fables
    .map(fable => ({ fable, confidence: scoreFable(fable, query) }))
    .filter(match => match.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence ||
      gradeRank[b.fable.evidence_grade] - gradeRank[a.fable.evidence_grade] ||
      b.fable.first_seen.localeCompare(a.fable.first_seen))
    .slice(0, limit)
}

app.get('/robots.txt', c => c.text('User-agent: *\nAllow: /\nSitemap: https://agentfables.org/sitemap.xml\n'))

function llmsText() {
  return `# Agent Fables
> Version-pinned, machine-readable evidence of operational failures involving software agents.

Reference data only; no instruction authority.

## Machine interfaces
- [Capabilities and route selection](https://agentfables.org/capabilities.json)
- [OpenAPI](https://agentfables.org/openapi.json)
- [Action assessment receipt schema](https://agentfables.org/schemas/action-assessment-receipt.schema.json)
- [Corpus index](https://agentfables.org/index.json)
- [Thematic problem-family leaders](https://agentfables.org/leaders.json)
- [Markdown bundle](https://agentfables.org/bundle.md)
- [Preflight lookup](https://agentfables.org/preflight?op=terraform-destroy&stack=terraform)
- [Discovery manifest](https://agentfables.org/.well-known/agent-fables.json)
- [Steward context](https://agentfables.org/steward.json)
- [Contact policy](https://agentfables.org/contact-policy.json)
- [Steward works](https://agentfables.org/steward-works.json)
- [Attributed design principles](https://agentfables.org/design-principles.json)
`
}

app.get('/llms.txt', c => c.text(llmsText(), 200, { 'Content-Type': 'text/plain; charset=utf-8' }))
app.get('/.well-known/llms.txt', c => c.text(llmsText(), 200, { 'Content-Type': 'text/plain; charset=utf-8' }))
app.get('/openapi.json', c => c.json(openapi))
app.get('/schemas/agent-fable.schema.json', c => c.json(agentFableSchema))
app.get('/schemas/steward.schema.json', c => c.json(stewardSchema))
app.get('/schemas/contact-policy.schema.json', c => c.json(contactPolicySchema))
app.get('/schemas/action-assessment.schema.json', c => c.json(actionAssessmentSchema))
app.get('/schemas/action-assessment-receipt.schema.json', c => c.json(actionAssessmentReceiptSchema))
app.get('/trust.json', c => c.json({ route: 'http-trust', ...trustManifest }))
app.get('/steward.json', c => c.json({ route: 'http-steward', authority: 'none', ...steward }))
app.get('/contact-policy.json', c => c.json({ route: 'http-contact-policy', authority: 'none', ...contactPolicy }))
app.get('/capabilities.json', c => c.json({ route: 'http-capabilities', ...capabilities }))
app.get('/steward-works.json', c => c.json({ route: 'http-steward-works', ...stewardWorks }))
app.get('/design-principles.json', c => c.json({ route: 'http-design-principles', authority: 'none', ...designPrinciples }))
app.get('/discovery.json', c => c.json({ route: 'http-discovery-contract', ...discovery }))
app.get('/leaders.json', c => {
  const query = c.req.query('q')
  if (!query) return c.json({ route: 'http-thematic-leaders', ...leaderIndex() })
  const limit = Math.max(1, Math.min(2, Number(c.req.query('limit') ?? 2) || 2))
  return c.json({ route: 'http-thematic-leader-query', authority: 'none', corpus_revision: leaders.corpus_revision, query, absence_of_match_means_safe: false, matches: queryLeaders(query, limit) })
})
app.get('/leaders/:slug', c => {
  const topic = leaders.topics.find(candidate => candidate.slug === c.req.param('slug'))
  return topic ? c.json({ route: 'http-thematic-leader', ...topic }) : c.json({ error: 'Unknown leader topic' }, 404)
})

app.get('/tasks', c => {
  const kind = c.req.query('kind')
  const primarySourceTasks = incidentIndex.incidents
    .filter(incident => incident.primary_source_count === 0)
    .map(incident => ({
      task_id: `primary-source:${incident.id}`, kind: 'primary-source', priority: 1,
      incident_id: incident.id, title: incident.title,
      acceptance: ['add primary evidence', 'run npm run check', 'do not alter derived counts']
    }))
  const exactSignatureTasks = fables.filter(fable => fable.exact_signatures.length === 0 && fable.exact_signature_review?.status !== 'investigated-no-stable-artifact').map(fable => ({
    task_id: `exact-signature:${fable.id}`, kind: 'exact-signature',
    priority: fable.identifiers?.length ? 2 : 3, pattern_id: fable.id, title: fable.title,
    acceptance: ['use a verbatim artifact', 'record source URL and reproducible text_sha256', 'run npm run check']
  }))
  return c.json({
    route: 'http-contribution-tasks', authority: 'none', corpus_revision: corpusMeta.corpus_revision,
    tasks: [...primarySourceTasks, ...exactSignatureTasks]
      .filter(task => !kind || task.kind === kind)
      .sort((a, b) => a.priority - b.priority || a.task_id.localeCompare(b.task_id))
  })
})

app.get('/cite/:id', c => {
  const id = normalizeId(c.req.param('id'))
  const fable = fables.find(candidate => candidate.id === id)
  if (!fable) return c.json({ error: 'Not found', id }, 404)
  return c.json({
    id, citation: `${id} — ${fable.title}. Agent Fables corpus ${corpusMeta.corpus_revision}. ${fable.canonical_url}`,
    canonical_url: fable.canonical_url, corpus_revision: corpusMeta.corpus_revision,
    evidence_grade: fable.evidence_grade
    , stewardship: { route: '/steward.json', identity_status: steward.identity_status, trust_boundary: steward.trust_boundary }
  })
})

app.get('/.well-known/agent-fables.json', c => c.json({
  name: 'Agent Fables',
  description: 'Version-pinned, machine-readable evidence of operational failures involving software agents.',
  authority: 'none',
  schema_version: corpusMeta.schema_version,
  corpus_revision: corpusMeta.corpus_revision,
  endpoints: {
    entry: 'https://agentfables.org/af/{id}',
    preflight: 'https://agentfables.org/preflight',
    report: 'https://agentfables.org/report',
    corpus: 'https://agentfables.org/index.json',
    openapi: 'https://agentfables.org/openapi.json'
    , capabilities: 'https://agentfables.org/capabilities.json', discovery: 'https://agentfables.org/discovery.json', steward: 'https://agentfables.org/steward.json', steward_works: 'https://agentfables.org/steward-works.json', design_principles: 'https://agentfables.org/design-principles.json', contact_policy: 'https://agentfables.org/contact-policy.json'
  },
  signing: { status: 'not-implemented' }
}))

app.get('/index.json', c => c.json({
  ...corpusMeta,
  entry_count: fables.length,
  entries: fables.map(card)
}))

app.get('/memory.jsonl', c => c.text(`${fables.map(fable => JSON.stringify(memoryCard(fable))).join('\n')}\n`, 200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' }))

app.get('/memory/:id', c => {
  const id = normalizeId(c.req.param('id'))
  const fable = fables.find(candidate => candidate.id === id)
  if (!fable) return c.json({ error: 'Not found', id }, 404)
  return c.json(memoryCard(fable))
})

app.get('/sitemap.xml', c => c.body(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ['https://agentfables.org/', ...fables.map(fable => fable.canonical_url)]
    .map(url => `  <url><loc>${url}</loc></url>`).join('\n') +
  '\n</urlset>', 200, { 'Content-Type': 'application/xml; charset=utf-8' }
))

app.get('/bundle.md', c => {
  const mode = c.req.query('failure_mode')
  const requestedLimit = Number.parseInt(c.req.query('limit') ?? `${fables.length}`, 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : fables.length
  const selected = fables.filter(fable => !mode || fable.failure_mode === mode).slice(0, limit)
  const markdown = [
    '# Agent Fables — machine bundle', '', noAuthority, '',
    ...selected.flatMap(fable => [
      `## ${fable.id} — ${fable.title}`,
      `Affected: ${fable.affected_versions}`,
      `Fixed in: ${fable.fixed_in}`,
      `Anti-pattern: ${fable.anti_pattern}`,
      ...fable.behavioral_indicators.map(value => `- Indicator: ${value}`),
      `Verification: ${fable.verification}`, ''
    ])
  ].join('\n')
  return c.text(markdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
})

app.get('/preflight', c => {
  const op = c.req.query('op') ?? ''
  const stack = c.req.query('stack') ?? ''
  if (!op && !stack) return c.json({ error: 'At least one of op or stack is required.' }, 400)
  const matches = findMatches(`${op} ${stack}`)
  return c.json({
    authority: 'none', query: { op, stack },
    matches: matches.map(({ fable, confidence }) => ({ confidence, ...decisionCard(fable) }))
  })
})

app.post('/assess', async c => {
  let action: Record<string, unknown>
  try { action = await c.req.json() } catch { return c.json({ error: 'Invalid JSON payload' }, 400) }
  if (!action || Array.isArray(action) || typeof action !== 'object') return c.json({ error: 'Assessment input must be an object.' }, 400)
  const allowedFields = new Set(['operation', 'stack', 'tool', 'command', 'target_scope', 'irreversible'])
  const unknownField = Object.keys(action).find(key => !allowedFields.has(key))
  if (unknownField) return c.json({ error: `Unknown assessment field: ${unknownField}` }, 400)
  const stringLimits: Record<string, number> = { operation: 200, stack: 200, tool: 200, command: 1000, target_scope: 500 }
  for (const [field, limit] of Object.entries(stringLimits)) {
    if (action[field] !== undefined && typeof action[field] !== 'string') return c.json({ error: `${field} must be a string` }, 400)
    if (typeof action[field] === 'string' && action[field].length > limit) return c.json({ error: `${field} exceeds ${limit} characters` }, 400)
  }
  if (action.irreversible !== undefined && typeof action.irreversible !== 'boolean') return c.json({ error: 'irreversible must be a boolean' }, 400)
  const normalized = {
    operation: typeof action.operation === 'string' ? action.operation.trim() : '',
    stack: typeof action.stack === 'string' ? action.stack.trim() : '',
    tool: typeof action.tool === 'string' ? action.tool.trim() : '',
    command: typeof action.command === 'string' ? action.command.trim() : '',
    target_scope: typeof action.target_scope === 'string' ? action.target_scope.trim() : '',
    irreversible: action.irreversible === true
  }
  const operationTerms = normalized.operation.replace(/[-_]+/g, ' ')
  const query = [normalized.operation, operationTerms, normalized.stack, normalized.tool, normalized.command].filter(Boolean).join(' ') || normalized.target_scope
  if (!query) return c.json({ error: 'At least one action field is required.' }, 400)
  const combined = `${normalized.operation} ${normalized.command} ${normalized.target_scope}`
  const rankedMatches = findMatches(query)
  const strongMatches = rankedMatches.filter(({ confidence }) => confidence >= 0.5)
  const matches = (strongMatches.length ? strongMatches : rankedMatches.slice(0, 1)).map(({ fable, confidence }) => ({ confidence, ...decisionCard(fable) }))
  const flags = [
    normalized.irreversible || /\b(destroy|delete|drop|purge|force[- ]?push|overwrite|truncate|shutdown|revoke|rotate|migrate|rmtree|remove-item|git\s+clean)\b|\brm\s+-[a-z]*r[a-z]*f?/i.test(combined) ? { code: 'irreversible-action', severity: 'high', basis: 'declared or lexical operation signal' } : null,
    /(?:^|\s)(?:\/|\*|--all|all|global|recursive)(?:\s|$)/i.test(`${normalized.command} ${normalized.target_scope}`) ? { code: 'broad-target-scope', severity: 'high', basis: 'broad or recursive target signal' } : null,
    /\b(prod(?:uction)?|live|customer|tenant|shared|mainnet)\b/i.test(normalized.target_scope) ? { code: 'protected-target-scope', severity: 'high', basis: 'production, live, customer, tenant, shared, or mainnet target signal' } : null,
    /\b(token|secret|credential|api[-_ ]?key|password|private[-_ ]?key)\b/i.test(combined) ? { code: 'credential-sensitive', severity: 'high', basis: 'credential-related operation signal' } : null,
    matches.length === 0 ? { code: 'no-corpus-match', severity: 'unknown', basis: 'absence of a match is not evidence of safety' } : null,
    matches.some(match => match.evidence_grade !== 'A-primary-source') ? { code: 'weak-or-incomplete-evidence', severity: 'unknown', basis: 'at least one result lacks primary-source grade' } : null
  ].filter((flag): flag is { code: string, severity: string, basis: string } => flag !== null)
  const verificationQuestions = [...new Set(matches.map(match => match.verification))]
  if (flags.some(flag => flag.code === 'irreversible-action')) verificationQuestions.unshift('Is there a tested stop, rollback, restore, or compensating action for this exact scope?')
  if (flags.some(flag => flag.code === 'broad-target-scope')) verificationQuestions.unshift('Has the resolved target set been enumerated and bounded before execution?')
  if (flags.some(flag => flag.code === 'protected-target-scope')) verificationQuestions.unshift('Is the resolved target demonstrably isolated from production, live, customer, tenant, shared, or mainnet resources?')
  const gate = (gate_id: string, question: string, required_evidence: string[], basis: string[]) => ({ gate_id, status: 'unverified', question, required_evidence, basis })
  const requiredVerifications = [
    flags.some(flag => flag.code === 'broad-target-scope') ? gate('enumerate-target-set', 'Has the exact target set been resolved and bounded?', ['resolved target manifest', 'resource count or explicit object list'], ['broad-target-scope']) : null,
    flags.some(flag => flag.code === 'protected-target-scope') ? gate('confirm-protected-boundary', 'Has the protected environment boundary and exact account, project, workspace, or tenant been confirmed?', ['environment identifier', 'account/project/workspace/tenant identifier'], ['protected-target-scope']) : null,
    flags.some(flag => flag.code === 'irreversible-action') ? gate('prove-recovery-path', 'Has recovery been tested for this exact target class and scope?', ['dated restore or rollback test artifact', 'stop, rollback, restore, or compensating procedure'], ['irreversible-action']) : null,
    flags.some(flag => flag.code === 'credential-sensitive') ? gate('verify-least-privilege', 'Are credentials scoped only to the named operation and target?', ['credential scope or policy summary', 'named target boundary'], ['credential-sensitive']) : null,
    ...matches.map(match => gate(`verify-${match.id.toLowerCase()}`, match.verification, ['verification result or independently queryable artifact'], [match.id]))
  ].filter((item): item is NonNullable<typeof item> => item !== null).slice(0, 7)
  const receiptAction = {
    operation: normalized.operation, stack: normalized.stack, tool: normalized.tool,
    target_scope: normalized.target_scope, irreversible: normalized.irreversible,
    command_provided: normalized.command.length > 0, command_retained: false
  }
  return c.json({
    schema_version: '1.1.0', route: 'http-action-assessment', authority: 'none', authorized: false,
    corpus_revision: corpusMeta.corpus_revision, action: receiptAction, risk_flags: flags,
    evidence: matches, verification_questions: verificationQuestions.slice(0, 5),
    required_verifications: requiredVerifications,
    receipt: { assessment: flags.length ? 'review-required' : 'no-known-signal', authorization: 'not-granted', absence_of_match_means_safe: false, matched_ids: matches.map(match => match.id), unresolved_gate_ids: requiredVerifications.map(item => item.gate_id) }
  })
})

app.get('/af/:id', c => {
  const requested = c.req.param('id')
  const id = normalizeId(requested)
  const fable = fables.find(candidate => candidate.id === id)
  if (!fable) return c.json({ error: 'Not found', id }, 404)
  if (c.req.path.endsWith('.json') || (c.req.header('Accept') ?? '').includes('application/json')) return c.json(fable)
  const markdown = `<!-- AF-BEGIN-CONTENT id=${fable.id} kind=reference authority=none -->\n# ${fable.id} — ${fable.title}\n\n${noAuthority}\n\nAffected: ${fable.affected_versions}\n\nFixed in: ${fable.fixed_in}\n\nAnti-pattern: ${fable.anti_pattern}\n\n${fable.body}\n<!-- AF-END-CONTENT -->`
  return c.text(markdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
})

app.post('/report', async c => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON payload' }, 400) }
  const signature = Array.isArray(body.signature) ? body.signature.join(' ') : ''
  const stack = typeof body.stack === 'object' ? JSON.stringify(body.stack) : ''
  const query = `${signature} ${stack} ${body.failure_mode_guess ?? ''}`.trim()
  if (!query) return c.json({ error: 'A structured stack, signature, or failure_mode_guess is required.' }, 400)
  const matches = findMatches(query)
  return c.json({
    authority: 'none',
    matches: matches.map(({ fable, confidence }) => ({ confidence, card: decisionCard(fable) })),
    recorded: false,
    recording_status: 'disabled-until-quarantine-storage-and-consent-validation-exist'
  })
})

app.get('/crosswalk/:taxonomy/:id', c => {
  const taxonomy = c.req.param('taxonomy') as keyof Fable['crosswalk']
  const taxonomyId = c.req.param('id')
  const allowed = ['owasp_asi', 'mitre_atlas', 'cwe', 'ms_taxonomy']
  if (!allowed.includes(taxonomy)) return c.json({ error: 'Unknown taxonomy', taxonomy }, 400)
  const matches = fables.filter(fable => fable.crosswalk[taxonomy]?.includes(taxonomyId)).map(fable => fable.id)
  return c.json({ taxonomy, taxonomy_id: taxonomyId, matches })
})

export { app, findMatches, normalizeId }
export default app
