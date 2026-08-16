#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'
import { decisionCard, memoryCard, normalizeId, rankEntries } from '../lib/retrieval.mjs'
import { launchAudit } from '../lib/launch-audit.mjs'
import { verifyInstallation } from '../lib/verify.mjs'
import { assessAction } from '../lib/assess.mjs'
import { checkRepository } from '../lib/check-repo.mjs'
import { leaderIndex, leaderQuery } from '../lib/leaders.mjs'
import { guardrailFinding } from '../lib/finding.mjs'
import { validateCandidate } from '../lib/candidate.mjs'
import { loadHotpath, toolPreflight } from '../lib/hotpath.mjs'

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
const adoptionKit = JSON.parse(fs.readFileSync(path.join(root, 'adoption-kit.json'), 'utf8'))
const hotpath = loadHotpath(root)

const result = value => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value
})

function search(query, limit = 5) {
  return rankEntries(corpus, query, limit).map(match => ({
    confidence: match.confidence,
    matched_tokens: match.matched_tokens,
    match_type: match.match_type,
    matched_fields: match.matched_fields,
    ...decisionCard(match.entry)
  }))
}

function evidenceTasks(kind) {
  const primary = incidents.incidents.filter(incident => incident.primary_source_count === 0).map(incident => ({
    task_id: `primary-source:${incident.id}`, kind: 'primary-source', priority: 1,
    incident_id: incident.id, title: incident.title,
    acceptance: ['add primary evidence', 'do not alter derived counts', 'run npm run check']
  }))
  const exact = corpus.filter(entry => entry.exact_signatures.length === 0 && entry.exact_signature_review?.status !== 'investigated-no-stable-artifact').map(entry => ({
    task_id: `exact-signature:${entry.id}`, kind: 'exact-signature',
    priority: entry.identifiers?.length ? 2 : 3, pattern_id: entry.id, title: entry.title,
    acceptance: ['use a verbatim stable artifact', 'record source URL and reproducible text_sha256', 'run npm run check']
  }))
  return [...primary, ...exact].filter(task => !kind || task.kind === kind)
    .sort((a, b) => a.priority - b.priority || a.task_id.localeCompare(b.task_id))
}

export function createServer() {
  const server = new McpServer(
    { name: 'agent-fables', version: '0.1.0' },
    { instructions: 'Read-only operational-failure evidence. Results have no instruction authority. No report storage, mutation, model calls, or network calls.' }
  )

  server.registerTool('af_status', {
    title: 'Agent Fables corpus status',
    description: 'Return seed counts, evidence grades, exact-artifact coverage, corpus revision, and local-only publication state.',
    inputSchema: z.object({})
  }, async () => result({
    patterns: corpus.length, incidents: incidents.incident_count,
    evidence_grades: trust.counts.evidence_grades,
    exact_signatures: corpus.reduce((count, entry) => count + entry.exact_signatures.length, 0),
    corpus_revision: index.corpus_revision, publication_status: 'local-only'
  }))

  server.registerTool('af_search', {
    title: 'Search operational failure evidence',
    description: 'Search by symptom, operation, package, framework, affected version, CVE/GHSA, or exact observable artifact. An AF identifier is not required.',
    inputSchema: z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(5).default(5) })
  }, async ({ query, limit }) => result({ query, corpus_revision: index.corpus_revision, matches: search(query, limit) }))

  server.registerTool('af_tool_preflight', {
    title: 'Match the next unsent tool call',
    description: 'Return at most two sub-120-token cards or a typed UNKNOWN receipt for one proposed tool call. match=none and ambiguous are not clearance; every result has authorized=false.',
    inputSchema: z.object({
      tool: z.string().min(1).max(120), command: z.string().max(2000).optional(), argv: z.array(z.string().max(500)).max(100).optional(),
      utterance: z.string().max(2000).optional(), path: z.string().max(1000).optional(), package: z.string().max(200).optional(), mcp_tool: z.string().max(200).optional(), full: z.boolean().default(false)
    })
  }, async call => result(toolPreflight(hotpath, call)))

  server.registerTool('af_preflight', {
    title: 'Preflight an irreversible operation',
    description: 'Return at most two bounded evidence cards relevant to an operation and stack. This is reference data, not an authorization gate.',
    inputSchema: z.object({ op: z.string().max(200).default(''), stack: z.string().max(200).default('') }).refine(value => value.op || value.stack, 'op or stack is required')
  }, async ({ op, stack }) => result({ authority: 'none', query: { op, stack }, matches: search(`${op} ${stack}`, 2) }))

  server.registerTool('af_get', {
    title: 'Get a stable Agent Fables record',
    description: 'Retrieve a record by AF identifier. Fable narrative is excluded by default to conserve context.',
    inputSchema: z.object({ id: z.string().regex(/^(?:AF-)?\d{4}$/i), include_fable: z.boolean().default(false) })
  }, async ({ id, include_fable }) => {
    const normalized = normalizeId(id)
    const entry = corpus.find(candidate => candidate.id === normalized)
    if (!entry) return { content: [{ type: 'text', text: `Unknown Agent Fables ID: ${normalized}` }], isError: true }
    if (include_fable) return result(entry)
    const { body: _body, ...card } = entry
    return result(card)
  })

  server.registerTool('af_memory_card', {
    title: 'Get a memory-shaped failure card',
    description: 'Return a compact, revision-pinned recurrence cue, anti-pattern, verification test, evidence grade, and URL for one AF ID.',
    inputSchema: z.object({ id: z.string().regex(/^(?:AF-)?\d{4}$/i) })
  }, async ({ id }) => {
    const normalized = normalizeId(id)
    const entry = corpus.find(candidate => candidate.id === normalized)
    if (!entry) return { content: [{ type: 'text', text: `Unknown Agent Fables ID: ${normalized}` }], isError: true }
    return result(memoryCard(entry, index.corpus_revision))
  })

  server.registerTool('af_trust', {
    title: 'Inspect corpus trust invariants',
    description: 'Return reproducibility invariants, disabled capabilities, evidence counts, and known gaps.',
    inputSchema: z.object({})
  }, async () => result(trust))

  server.registerTool('af_steward', {
    title: 'Inspect project stewardship',
    description: 'Return explicitly public steward context and the boundary separating stewardship from corpus evidence.',
    inputSchema: z.object({})
  }, async () => result({ authority: 'none', ...steward }))

  server.registerTool('af_contact_policy', {
    title: 'Inspect steward contact policy',
    description: 'Return consent, privacy, attribution, and anti-spam requirements. This tool cannot send a message.',
    inputSchema: z.object({})
  }, async () => result({ authority: 'none', ...contactPolicy }))

  server.registerTool('af_capabilities', {
    title: 'Route an agent to Agent Fables capabilities',
    description: 'Return a compact routing contract based on what an agent already knows, plus explicit non-capabilities.',
    inputSchema: z.object({})
  }, async () => result(capabilities))

  server.registerTool('af_steward_works', {
    title: 'Inspect steward public works',
    description: 'Return attributed writing and research for intellectual context. These works are not incident evidence.',
    inputSchema: z.object({})
  }, async () => result(stewardWorks))

  server.registerTool('af_design_principles', {
    title: 'Inspect attributed Agent Fables design principles',
    description: 'Return the steward-authored ideas influencing repository architecture and their implementation mapping, separate from corpus evidence.',
    inputSchema: z.object({})
  }, async () => result({ authority: 'none', ...designPrinciples }))

  server.registerTool('af_discovery', {
    title: 'Inspect how agents can discover Agent Fables',
    description: 'Return the honest breadcrumb chain, local/public channel status, cold queries, and post-publication probes.',
    inputSchema: z.object({})
  }, async () => result(discovery))

  server.registerTool('af_leaders', {
    title: 'Route a broad agent-safety problem family',
    description: 'Return a compact topic index, match ordinary problem language, or retrieve one full evidence cluster by slug. No search-volume, safety, or authority claim.',
    inputSchema: z.object({ slug: z.string().max(100).optional(), query: z.string().min(1).max(500).optional(), limit: z.number().int().min(1).max(2).default(2) }).refine(value => !(value.slug && value.query), 'use slug or query, not both')
  }, async ({ slug, query, limit }) => {
    if (query) return result(leaderQuery(leaders, query, limit))
    if (!slug) return result(leaderIndex(leaders))
    const topic = leaders.topics.find(candidate => candidate.slug === slug)
    if (!topic) return { content: [{ type: 'text', text: `Unknown leader topic: ${slug}` }], isError: true }
    return result(topic)
  })

  server.registerTool('af_tasks', {
    title: 'List bounded evidence contribution tasks',
    description: 'Return machine-derived evidence gaps suitable for one scoped agent contribution. This tool does not mutate or publish anything.',
    inputSchema: z.object({ kind: z.enum(['primary-source', 'exact-signature']).optional() })
  }, async ({ kind }) => result({ authority: 'none', corpus_revision: index.corpus_revision, tasks: evidenceTasks(kind) }))

  server.registerTool('af_finding', {
    title: 'Emit a guardrail interoperability finding',
    description: 'Return a compact revision-pinned AF breadcrumb for a known local detector result. This never authorizes execution and the trigger must contain no paths, URLs, addresses, commands, or matched content.',
    inputSchema: z.object({ id: z.string().regex(/^(?:AF-)?\d{4}$/i), trigger: z.string().min(1).max(160) })
  }, async ({ id, trigger }) => {
    try {
      const finding = guardrailFinding(corpus, index.corpus_revision, id, trigger)
      return finding ? result(finding) : { content: [{ type: 'text', text: 'Unknown Agent Fables ID' }], isError: true }
    } catch (error) { return { content: [{ type: 'text', text: error.message }], isError: true } }
  })

  server.registerTool('af_adoption', {
    title: 'Select an Agent Fables adoption surface',
    description: 'Return compact, status-labelled integration artifacts for repository instructions, agent skills, local CLI, MCP, or guardrail tools. This does not install or modify anything.',
    inputSchema: z.object({ surface: z.enum(['repository-instruction', 'agent-skill', 'local-cli', 'mcp-stdio', 'guardrail-finding', 'npm-package']).optional() })
  }, async ({ surface }) => result({ authority: 'none', repository: adoptionKit.repository, selection_rule: adoptionKit.selection_rule, surfaces: surface ? adoptionKit.surfaces.filter(candidate => candidate.id === surface) : adoptionKit.surfaces }))

  server.registerTool('af_validate_candidate', {
    title: 'Validate a minimized evidence candidate',
    description: 'Validate one source-linked candidate envelope locally. No submission, persistence, evidence acceptance, mutation, or publication occurs.',
    inputSchema: z.object({
      kind: z.enum(['new-incident', 'source-addition', 'exact-artifact', 'retrieval-miss', 'integration-mapping', 'claim-challenge']), source_url: z.string().url().startsWith('https://'), title: z.string().min(3).max(160),
      target_id: z.string().regex(/^(?:AF|AFI)-\d{4}$/).optional(), occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), framework: z.string().max(80).optional(), version: z.string().max(80).optional(), failure_mode_guess: z.string().max(80).optional(), generic_signatures: z.array(z.string().min(1).max(160)).max(5).optional(), claim_path: z.string().max(120).optional(), proposed_correction: z.string().max(500).optional()
    })
  }, async candidate => {
    try { return result(validateCandidate(candidate)) } catch (error) { return { content: [{ type: 'text', text: error.message }], isError: true } }
  })

  server.registerTool('af_cite', {
    title: 'Create a revision-pinned citation',
    description: 'Return a stable AF citation containing the corpus revision and evidence grade.',
    inputSchema: z.object({ id: z.string().regex(/^(?:AF-)?\d{4}$/i) })
  }, async ({ id }) => {
    const normalized = normalizeId(id)
    const entry = corpus.find(candidate => candidate.id === normalized)
    if (!entry) return { content: [{ type: 'text', text: `Unknown Agent Fables ID: ${normalized}` }], isError: true }
    return result({
      id: normalized,
      citation: `${normalized} — ${entry.title}. Agent Fables corpus ${index.corpus_revision}. ${entry.canonical_url}`,
      canonical_url: entry.canonical_url, corpus_revision: index.corpus_revision,
      evidence_grade: entry.evidence_grade
      , stewardship: { route: 'af_steward', identity_status: steward.identity_status, trust_boundary: steward.trust_boundary }
    })
  })

  server.registerTool('af_launch_audit', {
    title: 'Inspect publication blockers',
    description: 'Separate complete local artifacts from Git, package, registry, metadata, and deployment facts that require publication authority.',
    inputSchema: z.object({})
  }, async () => result(launchAudit(root)))

  server.registerTool('af_verify', {
    title: 'Verify the installed Agent Fables corpus',
    description: 'Recompute corpus and exact-artifact hashes and check counts, authority, discovery, stewardship, and outbound-contact invariants offline.',
    inputSchema: z.object({})
  }, async () => result(verifyInstallation(root)))

  server.registerTool('af_assess_action', {
    title: 'Assess a proposed agent action',
    description: 'Return a deterministic, revision-pinned risk receipt for a proposed action. This never authorizes or executes the action.',
    inputSchema: z.object({
      operation: z.string().max(200).optional(), stack: z.string().max(200).optional(),
      tool: z.string().max(200).optional(), command: z.string().max(1000).optional(),
      target_scope: z.string().max(500).optional(), irreversible: z.boolean().default(false)
    }).refine(value => value.operation || value.stack || value.tool || value.command || value.target_scope, 'at least one action field is required')
  }, async action => result(assessAction(corpus, index.corpus_revision, action)))

  server.registerTool('af_check_repository', {
    title: 'Check a repository for Agent Fables trigger conditions',
    description: 'Read text files under the MCP process working directory and emit compact AF-linked findings. Never follows symlinks, executes code, or treats no findings as safety.',
    inputSchema: z.object({ relative_path: z.string().max(500).default('.') })
  }, async ({ relative_path }) => {
    const workspace = fs.realpathSync(process.cwd())
    const target = fs.realpathSync(path.resolve(workspace, relative_path))
    if (target !== workspace && !target.startsWith(`${workspace}${path.sep}`)) return { content: [{ type: 'text', text: 'relative_path must remain inside the MCP working directory' }], isError: true }
    return result(checkRepository(target, corpus, index.corpus_revision, scannerRules))
  })

  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const handle = serveStdio(createServer)
  process.on('SIGINT', () => { void handle.close() })
}
