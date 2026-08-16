import fs from 'node:fs'
import path from 'node:path'

const jsonl = file => fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))

export function loadRetrievalHotpath(root) {
  return {
    rules: jsonl(path.join(root, 'tool-index-retrieval.jsonl')),
    cards: new Map(fs.readdirSync(path.join(root, 'cards')).filter(file => /^AF-\d{4}\.json$/.test(file)).map(file => { const card = JSON.parse(fs.readFileSync(path.join(root, 'cards', file), 'utf8')); return [card.id, card] })),
    revision: JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8')).corpus_revision
  }
}

// Named predicates over the extended hotpath-input shape, keyed by the closed match_kind
// enum from prd/06-breadcrumb-architecture.md's follow-on spec. This is deliberately a
// dispatch table, not a "when" expression parser -- evaluating agent-supplied condition
// strings would be the injection surface AF-0016/AF-0017 exist to warn about.
export const RETRIEVAL_MATCH_KINDS = [
  'tool_name', 'snippet_used_as_fulltext', 'fetch_error_cited', 'listing_as_body',
  'cite_unbound', 'memory_as_world', 'incomplete_index_as_empty', 'stale_prior_turn',
  'image_invented', 'unexecuted_as_done'
]

const hasCites = input => Array.isArray(input.draft_cite_tokens) && input.draft_cite_tokens.length > 0

const predicates = {
  tool_name: () => true,
  snippet_used_as_fulltext: input => input.result_shape === 'snippets' && hasCites(input),
  fetch_error_cited: input => ['errors', 'empty_download'].includes(input.result_shape) && hasCites(input),
  listing_as_body: input => input.result_shape === 'directory_listing',
  cite_unbound: input => hasCites(input) && Array.isArray(input.source_ids_issued) &&
    input.draft_cite_tokens.some(token => !input.source_ids_issued.includes(token)),
  memory_as_world: input => input.tool === 'memory_search' && hasCites(input),
  incomplete_index_as_empty: input => input.result_shape === 'incomplete',
  stale_prior_turn: input => Array.isArray(input.prior_turn_tool_ids) && input.prior_turn_tool_ids.length > 0 && input.result_shape == null,
  image_invented: () => false, // no schema field for tool-issued image ids yet; reserved for AF-0027
  unexecuted_as_done: input => input.executed === false
}

// Shares hotpath-receipt.schema.json (route stays 'tool-call-hotpath') deliberately --
// this is the same contract extended to a wider tool surface, not a parallel one.
export function retrievalPreflight(data, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !String(input.tool ?? '').trim()) throw new Error('retrieval hotpath input requires a tool')
  const hit = data.rules.find(rule => {
    if (rule.tool && rule.tool !== input.tool) return false
    const predicate = predicates[rule.match_kind]
    return predicate ? predicate(input) : false
  })
  const ids = hit?.ids ?? []
  if (ids.length === 0) {
    return {
      schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'none', reason: 'no_corpus_hit',
      authority: 'none', authorized: false, corpus_revision: data.revision, trigger_id: null,
      cards: [], similar_rejected: (hit?.if_unsure ?? []).slice(0, 2),
      required_verifications: [{ id: 'independent_source_before_claim', status: 'unverified' }], cite: null
    }
  }
  const cards = ids.map(id => data.cards.get(id)).filter(Boolean)
  return {
    schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'hit', reason: 'corpus_hit',
    authority: 'none', authorized: false, corpus_revision: data.revision, trigger_id: hit.id,
    cards, similar_rejected: [],
    required_verifications: cards.flatMap(card => card.verify.map((predicate, index) => ({ id: `${card.id.toLowerCase()}-predicate-${index + 1}`, status: 'unverified', predicate }))),
    cite: cards.map(card => ({ id: card.id, corpus_revision: data.revision, card_rev: card.rev, source: 'card' }))
  }
}
