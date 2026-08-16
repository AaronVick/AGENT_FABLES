import { normalizeId } from './retrieval.mjs'

export function guardrailFinding(corpus, corpusRevision, id, trigger) {
  const patternId = normalizeId(id)
  const entry = corpus.find(candidate => candidate.id === patternId)
  if (!entry) return null
  const genericTrigger = String(trigger ?? '').trim()
  if (!genericTrigger || genericTrigger.length > 160 || /[\\/]|(?:https?:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/.test(genericTrigger)) {
    throw new Error('trigger must be a generic 1-160 character label without paths, URLs, or addresses')
  }
  return {
    schema_version: '1.0.0', authority: 'none', authorization: 'not-granted', pattern_id: patternId,
    corpus_revision: corpusRevision, evidence_grade: entry.evidence_grade, trigger: genericTrigger,
    canonical_url: entry.canonical_url,
    breadcrumb: `agent-fables: ${patternId} | evidence=${entry.evidence_grade} | revision=${corpusRevision} | trigger=${genericTrigger} | ${entry.canonical_url}`
  }
}
