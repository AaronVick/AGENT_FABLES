const gradeRank = { 'A-primary-source': 3, 'B-indexed-public-report': 2, 'C-secondary-only': 1 }

export function tokenize(value) {
  return String(value ?? '').toLowerCase().split(/[^a-z0-9.+-]+/).filter(token => token.length > 2)
}

export function searchableText(entry) {
  return [
    entry.id, entry.title, entry.failure_mode, entry.affected_versions, entry.fixed_in,
    ...(entry.identifiers ?? []),
    ...entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]),
    ...entry.behavioral_indicators,
    ...entry.exact_signatures.map(signature => typeof signature === 'string' ? signature : signature.text)
  ].join(' ').toLowerCase()
}

export function rankEntries(entries, query, limit = 5) {
  const queryTokens = [...new Set(tokenize(query))]
  if (queryTokens.length === 0) return []
  return entries.map(entry => {
    const haystack = searchableText(entry)
    const matched = queryTokens.filter(token => haystack.includes(token))
    return { entry, confidence: matched.length / queryTokens.length, matched_tokens: matched }
  }).filter(result => result.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence ||
      gradeRank[b.entry.evidence_grade] - gradeRank[a.entry.evidence_grade] ||
      b.entry.first_seen.localeCompare(a.entry.first_seen))
    .slice(0, limit)
}

export function decisionCard(entry) {
  return {
    id: entry.id,
    confidence_basis: 'lexical-token-overlap',
    evidence_grade: entry.evidence_grade,
    affected_versions: entry.affected_versions,
    fixed_in: entry.fixed_in,
    anti_pattern: entry.anti_pattern,
    mitigation: entry.mitigation,
    verification: entry.verification,
    primary_sources: entry.provenance
      .filter(source => source.authority === 'primary')
      .slice(0, 2)
      .map(source => source.url)
  }
}

export function memoryCard(entry, corpusRevision) {
  return {
    id: entry.id,
    anti_pattern: entry.anti_pattern,
    verification: entry.verification,
    evidence_grade: entry.evidence_grade,
    corpus_revision: corpusRevision,
    canonical_url: entry.canonical_url,
    authority: 'none'
  }
}

export function normalizeId(value) {
  const clean = String(value).replace(/\.(?:md|json)$/i, '')
  return /^\d{4}$/.test(clean) ? `AF-${clean}` : clean.toUpperCase()
}
