import { decisionCard, rankEntries } from './retrieval.mjs'

const irreversibleTerms = /\b(destroy|delete|drop|purge|force[- ]?push|overwrite|truncate|shutdown|revoke|rotate|migrate|rmtree|remove-item|git\s+clean)\b|\brm\s+-[a-z]*r[a-z]*f?/i
const broadScopeTerms = /(?:^|\s)(?:\/|\*|--all|all|global|recursive)(?:\s|$)/i
const credentialTerms = /\b(tokens?|secrets?|credentials?|api[-_ ]?keys?|passwords?|private[-_ ]?keys?)\b/i
const protectedScopeTerms = /\b(prod(?:uction)?|live|customer|tenant|shared|mainnet)\b/i
const actionFields = new Set(['operation', 'stack', 'tool', 'command', 'target_scope', 'irreversible'])
const actionLimits = { operation: 200, stack: 200, tool: 200, command: 1000, target_scope: 500 }

function gate(gate_id, question, required_evidence, basis) {
  return { gate_id, status: 'unverified', question, required_evidence, basis }
}

export function assessAction(corpus, corpusRevision, action) {
  if (!action || Array.isArray(action) || typeof action !== 'object') throw new Error('assessment input must be an object')
  const unknown = Object.keys(action).filter(key => !actionFields.has(key))
  if (unknown.length) throw new Error(`assessment input has unknown field: ${unknown[0]}`)
  for (const [field, limit] of Object.entries(actionLimits)) {
    if (action[field] !== undefined && typeof action[field] !== 'string') throw new Error(`${field} must be a string`)
    if (action[field]?.length > limit) throw new Error(`${field} exceeds ${limit} characters`)
  }
  if (action.irreversible !== undefined && typeof action.irreversible !== 'boolean') throw new Error('irreversible must be a boolean')
  const normalized = {
    operation: String(action.operation ?? '').trim(),
    stack: String(action.stack ?? '').trim(),
    tool: String(action.tool ?? '').trim(),
    command: String(action.command ?? '').trim(),
    target_scope: String(action.target_scope ?? '').trim(),
    irreversible: action.irreversible === true
  }
  const operationTerms = normalized.operation.replace(/[-_]+/g, ' ')
  const query = [normalized.operation, operationTerms, normalized.stack, normalized.tool, normalized.command].filter(Boolean).join(' ') || normalized.target_scope
  if (!query) throw new Error('assessment requires operation, stack, tool, command, or target_scope')
  const ranked = rankEntries(corpus, query, 2)
  const selected = ranked.filter(match => match.confidence >= 0.5)
  const matches = (selected.length ? selected : ranked.slice(0, 1)).map(match => ({ confidence: match.confidence, matched_tokens: match.matched_tokens, ...decisionCard(match.entry) }))
  const combined = `${normalized.operation} ${normalized.command} ${normalized.target_scope}`
  const flags = [
    normalized.irreversible || irreversibleTerms.test(combined) ? { code: 'irreversible-action', severity: 'high', basis: 'declared or lexical operation signal' } : null,
    broadScopeTerms.test(`${normalized.command} ${normalized.target_scope}`) ? { code: 'broad-target-scope', severity: 'high', basis: 'broad or recursive target signal' } : null,
    protectedScopeTerms.test(normalized.target_scope) ? { code: 'protected-target-scope', severity: 'high', basis: 'production, live, customer, tenant, shared, or mainnet target signal' } : null,
    credentialTerms.test(combined) ? { code: 'credential-sensitive', severity: 'high', basis: 'credential-related operation signal' } : null,
    matches.length === 0 ? { code: 'no-corpus-match', severity: 'unknown', basis: 'absence of a match is not evidence of safety' } : null,
    matches.some(match => match.evidence_grade !== 'A-primary-source') ? { code: 'weak-or-incomplete-evidence', severity: 'unknown', basis: 'at least one result lacks primary-source grade' } : null
  ].filter(Boolean)
  const verificationQuestions = [...new Set(matches.flatMap(match => [match.verification]))]
  if (flags.some(flag => flag.code === 'irreversible-action')) verificationQuestions.unshift('Is there a tested stop, rollback, restore, or compensating action for this exact scope?')
  if (flags.some(flag => flag.code === 'broad-target-scope')) verificationQuestions.unshift('Has the resolved target set been enumerated and bounded before execution?')
  if (flags.some(flag => flag.code === 'protected-target-scope')) verificationQuestions.unshift('Is the resolved target demonstrably isolated from production, live, customer, tenant, shared, or mainnet resources?')
  const requiredVerifications = [
    flags.some(flag => flag.code === 'broad-target-scope') ? gate('enumerate-target-set', 'Has the exact target set been resolved and bounded?', ['resolved target manifest', 'resource count or explicit object list'], ['broad-target-scope']) : null,
    flags.some(flag => flag.code === 'protected-target-scope') ? gate('confirm-protected-boundary', 'Has the protected environment boundary and exact account, project, workspace, or tenant been confirmed?', ['environment identifier', 'account/project/workspace/tenant identifier'], ['protected-target-scope']) : null,
    flags.some(flag => flag.code === 'irreversible-action') ? gate('prove-recovery-path', 'Has recovery been tested for this exact target class and scope?', ['dated restore or rollback test artifact', 'stop, rollback, restore, or compensating procedure'], ['irreversible-action']) : null,
    flags.some(flag => flag.code === 'credential-sensitive') ? gate('verify-least-privilege', 'Are credentials scoped only to the named operation and target?', ['credential scope or policy summary', 'named target boundary'], ['credential-sensitive']) : null,
    ...matches.map(match => gate(`verify-${match.id.toLowerCase()}`, match.verification, ['verification result or independently queryable artifact'], [match.id]))
  ].filter(Boolean).slice(0, 7)
  const receiptAction = {
    operation: normalized.operation,
    stack: normalized.stack,
    tool: normalized.tool,
    target_scope: normalized.target_scope,
    irreversible: normalized.irreversible,
    command_provided: normalized.command.length > 0,
    command_retained: false
  }
  return {
    schema_version: '1.1.0', route: 'offline-action-assessment', authority: 'none', authorized: false,
    corpus_revision: corpusRevision, action: receiptAction, risk_flags: flags,
    evidence: matches, verification_questions: verificationQuestions.slice(0, 5),
    required_verifications: requiredVerifications,
    receipt: {
      assessment: flags.length ? 'review-required' : 'no-known-signal',
      authorization: 'not-granted',
      absence_of_match_means_safe: false,
      matched_ids: matches.map(match => match.id),
      unresolved_gate_ids: requiredVerifications.map(item => item.gate_id)
    }
  }
}
