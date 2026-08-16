#!/usr/bin/env node
// Generated standalone runtime. No dependencies, network calls, or corpus file reads.
import fs from 'node:fs'

const corpusRevision = __CORPUS_REVISION__
const corpus = __CORPUS__
const falseSafety = __FALSE_SAFETY__
const retrievalNegatives = __RETRIEVAL_NEGATIVES__
const toolRules = __TOOL_RULES__
const utteranceRules = __UTTERANCE_RULES__
const cards = __CARDS__
const ignored = new Set(['the', 'and', 'for', 'from', 'into', 'that', 'this', 'with', 'were', 'was', 'its', 'own', 'after', 'before', 'without', 'while', 'through'])
const tokenize = value => String(value ?? '').toLowerCase().split(/[^a-z0-9.+-]+/).filter(token => token.length > 2 && !ignored.has(token))
const related = (left, right) => left === right || (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left)))
const searchable = entry => [entry.id, entry.title, entry.failure_mode, entry.affected_versions, entry.fixed_in, ...(entry.identifiers ?? []), ...(entry.retrieval_aliases ?? []), ...entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]), ...entry.behavioral_indicators, ...(entry.trigger_conditions ?? []), entry.anti_pattern, ...entry.mitigation, entry.verification, ...entry.exact_signatures.map(item => item.text)].join(' ')
const matchMetadata = (entry, query, matched, confidence) => {
  const normalized = String(query).trim().toLowerCase()
  const groups = {
    exact_artifact: entry.exact_signatures.map(item => item.text), identifier: [entry.id, ...(entry.identifiers ?? [])],
    stack_version: entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]).concat([entry.affected_versions, entry.fixed_in]),
    behavioral: [...entry.behavioral_indicators, ...(entry.trigger_conditions ?? []), entry.anti_pattern, ...entry.mitigation, entry.verification],
    lexical: [entry.title, entry.failure_mode, ...(entry.retrieval_aliases ?? [])]
  }
  const matchedFields = Object.entries(groups).filter(([field, values]) => {
    if (field === 'exact_artifact' || field === 'identifier') return normalized.length >= 4 && values.some(value => normalized.includes(String(value).toLowerCase()) || String(value).toLowerCase().includes(normalized))
    return matched.some(token => tokenize(values.join(' ')).some(candidate => related(token, candidate)))
  }).map(([field]) => field)
  const matchType = matchedFields.includes('exact_artifact') ? 'exact-artifact' : matchedFields.includes('identifier') ? 'identifier' : matchedFields.includes('stack_version') ? 'stack-version' : matchedFields.includes('behavioral') ? 'behavioral' : confidence < 0.5 ? 'weak-lexical' : 'lexical'
  return { match_type: matchType, matched_fields: matchedFields }
}
const rank = (query, limit = 5) => {
  const wanted = [...new Set(tokenize(query))]
  if (!wanted.length) return []
  return corpus.map(entry => {
    const available = [...new Set(tokenize(searchable(entry)))]
    const matched = wanted.filter(token => available.some(candidate => related(token, candidate)))
    const confidence = matched.length / wanted.length
    return { entry, confidence, matched_tokens: matched, ...matchMetadata(entry, query, matched, confidence) }
  }).filter(item => item.confidence > 0).sort((a, b) => b.confidence - a.confidence || b.entry.evidence_grade.localeCompare(a.entry.evidence_grade)).slice(0, limit)
}
const card = ({ entry, confidence, matched_tokens, match_type, matched_fields }) => ({
  id: entry.id, confidence, matched_tokens, match_type, matched_fields, evidence_grade: entry.evidence_grade,
  affected_versions: entry.affected_versions, fixed_in: entry.fixed_in, anti_pattern: entry.anti_pattern,
  mitigation: entry.mitigation, verification: entry.verification,
  primary_sources: entry.provenance.filter(source => source.authority === 'primary').slice(0, 2).map(source => source.url)
})
const emit = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
const fail = message => { process.stderr.write(`${message}\n`); process.exitCode = 2 }
const [command = 'help', ...args] = process.argv.slice(2)
const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined }

function assess(action) {
  const query = [action.operation, action.stack, action.tool, action.command, action.target_scope].filter(Boolean).join(' ')
  const evidence = rank(query, 2).map(card)
  const combined = `${action.operation ?? ''} ${action.command ?? ''} ${action.target_scope ?? ''}`
  const flags = [
    action.irreversible === true || /\b(destroy|delete|drop|purge|force[- ]?push|overwrite|truncate|shutdown|revoke|rotate|migrate|rmtree)\b|\brm\s+-[a-z]*r[a-z]*f?/i.test(combined) ? { code: 'irreversible-action', severity: 'high' } : null,
    /(?:^|\s)(?:\/|\*|--all|all|global|recursive)(?:\s|$)/i.test(combined) ? { code: 'broad-target-scope', severity: 'high' } : null,
    /\b(prod(?:uction)?|live|customer|tenant|shared|mainnet)\b/i.test(String(action.target_scope ?? '')) ? { code: 'protected-target-scope', severity: 'high' } : null,
    /\b(tokens?|secrets?|credentials?|api[-_ ]?keys?|passwords?|private[-_ ]?keys?)\b/i.test(combined) ? { code: 'credential-sensitive', severity: 'high' } : null,
    evidence.length === 0 ? { code: 'no-corpus-match', severity: 'unknown' } : null
  ].filter(Boolean)
  const gates = [...new Set(evidence.map(item => item.id))].map(id => ({ gate_id: `verify-${id.toLowerCase()}`, status: 'unverified' }))
  if (flags.some(flag => flag.code === 'irreversible-action')) gates.unshift({ gate_id: 'prove-recovery-path', status: 'unverified' })
  return { schema_version: '1.0.0-sandbox', route: 'sandbox-action-assessment', authority: 'none', authorized: false, corpus_revision: corpusRevision, risk_flags: flags, evidence, required_verifications: gates, receipt: { assessment: flags.length ? 'review-required' : 'no-known-signal', authorization: 'not-granted', absence_of_match_means_safe: false, matched_ids: evidence.map(item => item.id), unresolved_gate_ids: gates.map(item => item.gate_id) } }
}

function preflightTool(input) {
  const lower = value => String(value ?? '').toLowerCase()
  const command = lower(input.command ?? (Array.isArray(input.argv) ? input.argv.join(' ') : ''))
  const tool = lower(input.tool), pathValue = lower(input.path), packageValue = lower(input.package), mcpTool = lower(input.mcp_tool)
  const near = toolRules.find(rule => lower(rule.tool) === tool && rule.not.some(value => command.includes(lower(value))))
  const hit = toolRules.find(rule => (lower(rule.tool) === tool || (rule.mcp_tool && lower(rule.mcp_tool) === mcpTool)) && !rule.not.some(value => command.includes(lower(value))) && (rule.argv_any.some(value => command.includes(lower(value))) || (rule.argv_all.length && rule.argv_all.every(value => command.includes(lower(value)))) || (rule.path_regex && new RegExp(rule.path_regex, 'i').test(pathValue)) || (rule.package && packageValue.includes(lower(rule.package))) || (rule.mcp_tool && lower(rule.mcp_tool) === mcpTool)))
  const utterance = utteranceRules.find(rule => rule.phrases.some(phrase => lower(input.utterance).includes(lower(phrase))))
  let ids = hit?.ids ?? utterance?.ids ?? [], reason = ids.length ? 'corpus_hit' : near ? 'near_miss_only' : 'no_corpus_hit'
  if (hit && utterance && new Set([...hit.if_unsure, ...utterance.if_unsure]).size > 1) { ids = [...new Set([...hit.ids, ...utterance.ids, ...hit.if_unsure, ...utterance.if_unsure])].slice(0, 2); reason = 'ambiguous' }
  if (!ids.length) return { schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'none', reason, authority: 'none', authorized: false, corpus_revision: corpusRevision, trigger_id: near?.id ?? null, cards: [], similar_rejected: (near?.ids ?? []).slice(0, 2), required_verifications: [{ id: 'independent_artifact_before_mutate', status: 'unverified' }], cite: null }
  const selected = ids.map(id => cards[id]).filter(Boolean)
  return { schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'hit', reason, authority: 'none', authorized: false, corpus_revision: corpusRevision, trigger_id: hit?.id ?? utterance?.id ?? null, cards: selected, similar_rejected: [], required_verifications: selected.flatMap(card => card.verify.map((predicate, index) => ({ id: `${card.id.toLowerCase()}-predicate-${index + 1}`, status: 'unverified', predicate }))), cite: selected.map(card => ({ id: card.id, corpus_revision: corpusRevision, card_rev: card.rev, source: 'card' })) }
}

if (command === 'tool-preflight') {
  if (!args.includes('--stdin')) fail('tool-preflight requires --stdin')
  else { let call; try { call = JSON.parse(fs.readFileSync(0, 'utf8')) } catch { fail('tool-preflight requires one JSON object') } if (call) emit(preflightTool(call)) }
} else if (command === 'status') emit({ route: 'sandbox-status', authority: 'none', authorized: false, corpus_revision: corpusRevision, patterns: corpus.length, dependencies: 0, network_required: false })
else if (command === 'search') {
  const query = args.join(' ')
  if (!query) fail('search requires a query')
  else emit({ route: 'sandbox-search', authority: 'none', corpus_revision: corpusRevision, query, matches: rank(query).map(card), absence_of_match_means_safe: false })
} else if (command === 'preflight') {
  const query = `${option('op') ?? ''} ${option('stack') ?? ''}`.trim()
  if (!query) fail('preflight requires --op or --stack')
  else emit({ route: 'sandbox-preflight', authority: 'none', authorized: false, corpus_revision: corpusRevision, matches: rank(query, 2).map(card), absence_of_match_means_safe: false })
} else if (command === 'get') {
  const id = String(args[0] ?? '').toUpperCase()
  const entry = corpus.find(item => item.id === id)
  if (!entry) fail(`unknown ID: ${id}`)
  else emit({ route: 'sandbox-get', authority: 'none', corpus_revision: corpusRevision, entry })
} else if (command === 'eval') {
  const cases = falseSafety.map(fixture => {
    const result = assess(fixture.action)
    const passed = result.authorized === false && result.receipt.authorization === 'not-granted' && result.receipt.absence_of_match_means_safe === false && result.required_verifications.length > 0 && result.risk_flags.some(flag => flag.code === fixture.required_flag) && (!fixture.expected || result.evidence.some(item => item.id === fixture.expected))
    return { id: fixture.id, passed, required_flag: fixture.required_flag, expected: fixture.expected ?? null, matched_ids: result.receipt.matched_ids }
  })
  const negatives = retrievalNegatives.map(fixture => { const match = rank(fixture.query, 1)[0]; return { id: fixture.id, passed: !match || match.confidence < 0.5, top_confidence: match?.confidence ?? 0, match_type: match ? matchMetadata(match.entry, fixture.query, match.matched_tokens, match.confidence).match_type : null } })
  const passed = cases.filter(item => item.passed).length
  const negativePassed = negatives.filter(item => item.passed).length
  emit({ schema_version: '1.1.0', eval: 'retrieval-and-false-safety', corpus_revision: corpusRevision, sandbox_runnable: true, false_safety: { fixtures: cases.length, passed, pass_rate: passed / cases.length, cases }, negative_controls: { fixtures: negatives.length, passed: negativePassed, false_positive_rate: 1 - negativePassed / negatives.length, strong_match_threshold: 0.5, cases: negatives } })
  if (cases.some(item => !item.passed) || negatives.some(item => !item.passed)) process.exitCode = 1
} else if (command === 'assess') {
  if (!args.includes('--stdin')) fail('assess requires --stdin')
  else {
    const raw = fs.readFileSync(0, 'utf8')
    if (Buffer.byteLength(raw) > 16384) fail('assessment exceeds 16384 bytes')
    else {
      let action
      try { action = JSON.parse(raw) } catch { fail('assessment must be one JSON object') }
      if (action) {
        const allowed = new Set(['operation', 'stack', 'tool', 'command', 'target_scope', 'irreversible'])
        const unknown = Object.keys(action).filter(key => !allowed.has(key))
        if (unknown.length) fail(`unknown field: ${unknown[0]}`)
        else {
          const query = [action.operation, action.stack, action.tool, action.command, action.target_scope].filter(Boolean).join(' ')
          if (!query) fail('assessment requires a proposed action field')
          else {
            emit(assess(action))
          }
        }
      }
    }
  }
} else emit({ name: 'Agent Fables sandbox runtime', authority: 'none', commands: ['tool-preflight --stdin', 'status', 'search <query>', 'preflight --op <operation> --stack <stack>', 'get AF-####', 'assess --stdin', 'eval'], network_required: false, dependencies: 0 })
