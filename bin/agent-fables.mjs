#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { decisionCard, memoryCard, normalizeId, rankEntries } from '../lib/retrieval.mjs'
import { launchAudit } from '../lib/launch-audit.mjs'
import { verifyInstallation } from '../lib/verify.mjs'
import { assessAction } from '../lib/assess.mjs'
import { checkRepository } from '../lib/check-repo.mjs'
import { leaderIndex, leaderQuery } from '../lib/leaders.mjs'
import { guardrailFinding } from '../lib/finding.mjs'
import { validateCandidate } from '../lib/candidate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const corpus = fs.readFileSync(path.join(root, 'index.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const incidents = JSON.parse(fs.readFileSync(path.join(root, 'incidents.json'), 'utf8'))
const trust = JSON.parse(fs.readFileSync(path.join(root, 'trust.json'), 'utf8'))
const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
const capabilities = JSON.parse(fs.readFileSync(path.join(root, 'capabilities.json'), 'utf8'))
const stewardWorks = JSON.parse(fs.readFileSync(path.join(root, 'steward-works.json'), 'utf8'))
const designPrinciples = JSON.parse(fs.readFileSync(path.join(root, 'design-principles.json'), 'utf8'))
const discovery = JSON.parse(fs.readFileSync(path.join(root, 'discovery.json'), 'utf8'))
const scannerRules = JSON.parse(fs.readFileSync(path.join(root, 'scanner-rules.json'), 'utf8'))
const leaders = JSON.parse(fs.readFileSync(path.join(root, 'leaders.json'), 'utf8'))
const freshness = JSON.parse(fs.readFileSync(path.join(root, 'freshness.json'), 'utf8'))
const guardrailContract = JSON.parse(fs.readFileSync(path.join(root, 'guardrail-contract.json'), 'utf8'))
const contributionContract = JSON.parse(fs.readFileSync(path.join(root, 'contribution-contract.json'), 'utf8'))
const adoptionKit = JSON.parse(fs.readFileSync(path.join(root, 'adoption-kit.json'), 'utf8'))
const [command = 'help', ...args] = process.argv.slice(2)

const option = name => {
  const equals = args.find(value => value.startsWith(`--${name}=`))
  if (equals) return equals.slice(name.length + 3)
  const position = args.indexOf(`--${name}`)
  return position >= 0 ? args[position + 1] : undefined
}
const positional = args.filter((value, index) => !value.startsWith('--') && (index === 0 || !args[index - 1].startsWith('--')))
const format = option('format') ?? 'json'

function output(value) {
  if (format === 'markdown' && value.markdown) process.stdout.write(`${value.markdown}\n`)
  else process.stdout.write(`${JSON.stringify(value.json ?? value, null, 2)}\n`)
}

function matches(query, limit) {
  return rankEntries(corpus, query, limit).map(result => ({
    confidence: result.confidence,
    matched_tokens: result.matched_tokens,
    ...decisionCard(result.entry)
  }))
}

if (command === 'search') {
  const query = option('query') ?? positional.join(' ')
  if (!query) throw new Error('search requires a query')
  const results = matches(query, Number(option('limit') ?? 5))
  output({
    json: { route: 'offline-search', query, corpus_revision: index.corpus_revision, matches: results },
    markdown: [`# Agent Fables search`, `Query: ${query}`, '', ...results.flatMap(result => [
      `## ${result.id} (${result.confidence.toFixed(2)}, ${result.evidence_grade})`,
      `Affected: ${result.affected_versions}`, `Fixed in: ${result.fixed_in}`, `Verification: ${result.verification}`, ''
    ])].join('\n')
  })
} else if (command === 'preflight') {
  const op = option('op') ?? ''
  const stack = option('stack') ?? ''
  if (!op && !stack) throw new Error('preflight requires --op or --stack')
  output({ route: 'offline-preflight', authority: 'none', query: { op, stack }, matches: matches(`${op} ${stack}`, 2) })
} else if (command === 'get') {
  const id = normalizeId(positional[0] ?? option('id'))
  const entry = corpus.find(candidate => candidate.id === id)
  if (!entry) { process.stderr.write(`Unknown Agent Fables ID: ${id}\n`); process.exitCode = 2 }
  else output(entry)
} else if (command === 'memory') {
  const id = normalizeId(positional[0] ?? option('id'))
  const entry = corpus.find(candidate => candidate.id === id)
  if (!entry) { process.stderr.write(`Unknown Agent Fables ID: ${id}\n`); process.exitCode = 2 }
  else output({ route: 'offline-memory-card', ...memoryCard(entry, index.corpus_revision) })
} else if (command === 'status') {
  const grades = Object.groupBy(incidents.incidents, incident => incident.evidence_grade)
  output({
    route: 'offline-status', schema_version: index.schema_version,
    corpus_revision: index.corpus_revision, patterns: index.entry_count,
    incidents: index.incident_count,
    evidence_grades: Object.fromEntries(Object.entries(grades).map(([grade, values]) => [grade, values.length])),
    exact_signatures: corpus.reduce((count, entry) => count + entry.exact_signatures.length, 0),
    publication_status: 'local-only'
  })
} else if (command === 'trust') {
  output({ route: 'offline-trust', ...trust })
} else if (command === 'steward') {
  output({ route: 'offline-steward', authority: 'none', ...steward })
} else if (command === 'contact-policy') {
  output({ route: 'offline-contact-policy', authority: 'none', ...contactPolicy })
} else if (command === 'capabilities') {
  output({ route: 'offline-capabilities', ...capabilities })
} else if (command === 'steward-works') {
  output({ route: 'offline-steward-works', ...stewardWorks })
} else if (command === 'design-principles') {
  output({ route: 'offline-design-principles', authority: 'none', ...designPrinciples })
} else if (command === 'discovery') {
  output({ route: 'offline-discovery-contract', ...discovery })
} else if (command === 'freshness') {
  output({ route: 'offline-freshness', ...freshness, stale: new Date().toISOString().slice(0, 10) > freshness.stale_after })
} else if (command === 'guardrail-contract') {
  output({ route: 'offline-guardrail-contract', ...guardrailContract })
} else if (command === 'contribution-contract') {
  output({ route: 'offline-contribution-contract', ...contributionContract })
} else if (command === 'adoption') {
  const surface = option('surface') ?? positional[0]
  const surfaces = surface ? adoptionKit.surfaces.filter(candidate => candidate.id === surface) : adoptionKit.surfaces
  if (surface && surfaces.length === 0) { process.stderr.write(`Unknown adoption surface: ${surface}\n`); process.exitCode = 2 }
  else output({ route: 'offline-adoption-kit', authority: 'none', repository: adoptionKit.repository, selection_rule: adoptionKit.selection_rule, surfaces })
} else if (command === 'candidate') {
  if (!args.includes('--stdin')) throw new Error('candidate requires --stdin')
  const raw = fs.readFileSync(0, 'utf8')
  if (Buffer.byteLength(raw, 'utf8') > 8192) throw new Error('candidate --stdin payload exceeds 8192 bytes')
  let candidate
  try { candidate = JSON.parse(raw) } catch { throw new Error('candidate --stdin requires one JSON object') }
  output(validateCandidate(candidate))
} else if (command === 'leaders') {
  const query = option('query') ?? positional.join(' ')
  output({ route: query ? 'offline-thematic-leader-query' : 'offline-thematic-leaders', ...(query ? leaderQuery(leaders, query, Number(option('limit') ?? 2)) : leaderIndex(leaders)) })
} else if (command === 'leader') {
  const slug = positional[0] ?? option('slug')
  const topic = leaders.topics.find(candidate => candidate.slug === slug)
  if (!topic) { process.stderr.write(`Unknown leader topic: ${slug}\n`); process.exitCode = 2 }
  else output({ route: 'offline-thematic-leader', ...topic })
} else if (command === 'tasks') {
  const kind = option('kind')
  const primarySourceTasks = incidents.incidents
    .filter(incident => incident.primary_source_count === 0)
    .map(incident => ({
      task_id: `primary-source:${incident.id}`,
      kind: 'primary-source', priority: 1, incident_id: incident.id,
      title: incident.title,
      acceptance: ['add a first-party, vendor, maintainer, reviewed-advisory, or original researcher URL', 'set authority: primary', 'run npm run check', 'do not alter derived counts']
    }))
  const exactSignatureTasks = corpus
    .filter(entry => entry.exact_signatures.length === 0 && entry.exact_signature_review?.status !== 'investigated-no-stable-artifact')
    .map(entry => ({
      task_id: `exact-signature:${entry.id}`,
      kind: 'exact-signature', priority: entry.identifiers?.length ? 2 : 3,
      pattern_id: entry.id, title: entry.title,
      acceptance: ['use a verbatim runtime/advisory artifact, not a behavioral paraphrase', 'record source URL and reproducible text_sha256', 'run npm run check', 'leave empty when no defensible string exists']
    }))
  const tasks = [...primarySourceTasks, ...exactSignatureTasks]
    .filter(task => !kind || task.kind === kind)
    .sort((a, b) => a.priority - b.priority || a.task_id.localeCompare(b.task_id))
  output({ route: 'offline-contribution-tasks', authority: 'none', corpus_revision: index.corpus_revision, tasks })
} else if (command === 'finding') {
  const finding = guardrailFinding(corpus, index.corpus_revision, positional[0] ?? option('id'), option('trigger'))
  if (!finding) { process.stderr.write('Unknown Agent Fables ID\n'); process.exitCode = 2 }
  else output({ route: 'offline-guardrail-finding', ...finding })
} else if (command === 'cite') {
  const id = normalizeId(positional[0] ?? option('id'))
  const entry = corpus.find(candidate => candidate.id === id)
  if (!entry) { process.stderr.write(`Unknown Agent Fables ID: ${id}\n`); process.exitCode = 2 }
  else output({
    id: entry.id,
    citation: `${entry.id} — ${entry.title}. Agent Fables corpus ${index.corpus_revision}. ${entry.canonical_url}`,
    canonical_url: entry.canonical_url,
    corpus_revision: index.corpus_revision,
    evidence_grade: entry.evidence_grade
    , stewardship: { route: 'steward', identity_status: steward.identity_status, trust_boundary: steward.trust_boundary }
  })
} else if (command === 'launch-audit') {
  output(launchAudit(root))
} else if (command === 'verify') {
  const verification = verifyInstallation(root)
  output(verification)
  if (!verification.verified) process.exitCode = 1
} else if (command === 'assess') {
  let action
  if (args.includes('--stdin')) {
    const raw = fs.readFileSync(0, 'utf8')
    if (Buffer.byteLength(raw, 'utf8') > 16_384) throw new Error('assess --stdin payload exceeds 16384 bytes')
    try { action = JSON.parse(raw) } catch { throw new Error('assess --stdin requires one JSON object on stdin') }
    if (!action || Array.isArray(action) || typeof action !== 'object') throw new Error('assess --stdin requires one JSON object on stdin')
  } else {
    action = {
      operation: option('op') ?? option('operation'), stack: option('stack'), tool: option('tool'),
      command: option('command'), target_scope: option('target-scope'), irreversible: args.includes('--irreversible')
    }
  }
  output(assessAction(corpus, index.corpus_revision, action))
} else if (command === 'check') {
  const target = path.resolve(process.cwd(), option('path') ?? '.')
  output(checkRepository(target, corpus, index.corpus_revision, scannerRules))
} else {
  process.stdout.write(`Agent Fables offline interface

Commands:
  agent-fables status
  agent-fables search <symptom, package, version, CVE, or operation>
  agent-fables preflight --op <operation> --stack <framework>
  agent-fables get <AF-####>
  agent-fables memory <AF-####>
  agent-fables trust
  agent-fables steward
  agent-fables contact-policy
  agent-fables capabilities
  agent-fables steward-works
  agent-fables design-principles
  agent-fables discovery
  agent-fables freshness
  agent-fables guardrail-contract
  agent-fables contribution-contract
  agent-fables adoption [--surface <id>]
  agent-fables candidate --stdin < candidate.json
  agent-fables leaders [--query <broad problem>] [--limit 1|2]
  agent-fables leader <topic-slug>
  agent-fables tasks [--kind primary-source|exact-signature]
  agent-fables finding <AF-####> --trigger <generic-label>
  agent-fables cite <AF-####>
  agent-fables launch-audit
  agent-fables verify
  agent-fables assess --op <operation> [--stack <framework>] [--tool <tool>] [--command <command>] [--target-scope <scope>] [--irreversible]
  agent-fables assess --stdin < action.json
  agent-fables check [--path <repository>]

Options:
  --format json|markdown   JSON is the default
  --limit <n>              Search result limit
  --stdin                  Read one assessment JSON object from stdin; preferred when command text may be sensitive
`)
}
