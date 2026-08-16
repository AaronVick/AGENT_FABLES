// Publish-gate over a session-source-ledger.schema.json ledger and a draft claim graph.
// Generalizes external-cite-contract.json's fetch-or-silence rule (still valid as the
// simple fetch_url-only subset) to snippet/document/error/listing/empty_download shapes,
// per-query source partitioning, and claim-level support checks.
//
// Several match_kind reasons below correspond to AF-#### patterns this corpus does not
// yet have real, sourced evidence for (AF-0022..0024, AF-0026..0030, AF-0034, AF-0036).
// The checks are implemented because they are real, ID-independent verification logic --
// but pattern_id stays null until a genuine incident backs the ID. Never cite a pattern
// this corpus has not actually seeded.

const UNEVIDENCED = null // marks a check whose corresponding AF-#### is not yet seeded

function indexLedger(ledger) {
  return new Map((ledger?.entries ?? []).map(row => [row.source_id, row]))
}

export function checkCitationBinding(ledger, draftCiteTokens) {
  const bySourceId = indexLedger(ledger)
  const valid = []
  const invalid = []
  for (const token of draftCiteTokens ?? []) {
    const row = bySourceId.get(token)
    if (!row) {
      invalid.push({ token, match_kind: 'cite_unbound', pattern_id: UNEVIDENCED, reason: 'source_id not in this session ledger' })
      continue
    }
    if (!row.citable) {
      const patternId = ['error', 'empty_download'].includes(row.shape) ? 'AF-0021' : row.shape === 'listing' ? UNEVIDENCED : UNEVIDENCED
      invalid.push({ token, match_kind: 'fetch_error_cited', pattern_id: patternId, reason: `ledger row shape=${row.shape} is not citable` })
      continue
    }
    valid.push({ token, shape: row.shape, query_index: row.query_index ?? null })
  }
  return { valid, invalid, pass_rate: (draftCiteTokens?.length ?? 0) === 0 ? 1 : valid.length / draftCiteTokens.length }
}

export function checkClaimGraph(ledger, claims) {
  const bySourceId = indexLedger(ledger)
  return (claims ?? []).map(claim => {
    const rows = (claim.ledger_ids ?? []).map(id => bySourceId.get(id)).filter(Boolean)
    if (claim.support_type === 'unsupported') {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'unsupported_claim', pattern_id: UNEVIDENCED }
    }
    if (rows.length !== (claim.ledger_ids ?? []).length) {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'cite_unbound', pattern_id: UNEVIDENCED }
    }
    if (rows.some(row => !row.citable)) {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'fetch_error_cited', pattern_id: 'AF-0021' }
    }
    if (rows.some(row => row.shape === 'snippet') && claim.support_type === 'direct') {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'snippet_used_as_fulltext', pattern_id: 'AF-0020' }
    }
    if ((claim.hop ?? 0) >= 1 && claim.support_type === 'direct') {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'inference_presented_as_retrieved', pattern_id: UNEVIDENCED }
    }
    if (claim.query_index != null && rows.some(row => row.query_index != null && row.query_index !== claim.query_index)) {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'query_source_crossbind', pattern_id: UNEVIDENCED }
    }
    if (claim.cite_role === 'obligation' && claim.support_type !== 'meta') {
      return { sent_id: claim.sent_id, pass: false, match_kind: 'cite_obligation_misbind', pattern_id: UNEVIDENCED }
    }
    if (rows.length > 1 && claim.support_type === 'direct' && !rows.some(row => row.shape === 'document')) {
      // Cannot verify entailment with a pure function -- surface for review rather than
      // silently pass or silently fail a multi-source claim.
      return { sent_id: claim.sent_id, pass: null, match_kind: 'collage_claim_review_required', pattern_id: UNEVIDENCED }
    }
    return { sent_id: claim.sent_id, pass: true, match_kind: null, pattern_id: null }
  })
}

export function checkNegativeResultRequired({ searchedWithNoSupport, answeredWorldFact, hasNegativeResult }) {
  const violated = Boolean(searchedWithNoSupport) && Boolean(answeredWorldFact) && !hasNegativeResult
  return { pass: !violated, match_kind: violated ? 'negative_unstated' : null, pattern_id: UNEVIDENCED }
}
