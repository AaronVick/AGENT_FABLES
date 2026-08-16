const gradeRank = { 'A-primary-source': 3, 'B-indexed-public-report': 2, 'C-secondary-only': 1 }
const ignoredTokens = new Set(['the', 'and', 'for', 'from', 'into', 'that', 'this', 'with', 'were', 'was', 'its', 'own', 'after', 'before', 'without', 'while', 'through'])

export function tokenize(value) {
  return String(value ?? '').toLowerCase().split(/[^a-z0-9.+-]+/).filter(token => token.length > 2 && !ignoredTokens.has(token))
}

const related = (left, right) => left === right || (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left)))

export function searchableText(entry) {
  return [
    entry.id, entry.title, entry.failure_mode, entry.affected_versions, entry.fixed_in,
    ...(entry.identifiers ?? []),
    ...(entry.retrieval_aliases ?? []),
    ...entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]),
    ...entry.behavioral_indicators,
    ...(entry.trigger_conditions ?? []), entry.anti_pattern, ...(entry.mitigation ?? []), entry.verification,
    ...entry.exact_signatures.map(signature => typeof signature === 'string' ? signature : signature.text)
  ].join(' ').toLowerCase()
}

const values = (entry, field) => {
  if (field === 'exact_artifact') return entry.exact_signatures.map(signature => typeof signature === 'string' ? signature : signature.text)
  if (field === 'identifier') return [entry.id, ...(entry.identifiers ?? [])]
  if (field === 'stack_version') return entry.stacks.flatMap(stack => [stack.framework, ...stack.versions]).concat([entry.affected_versions, entry.fixed_in])
  if (field === 'behavioral') return [...entry.behavioral_indicators, ...(entry.trigger_conditions ?? []), entry.anti_pattern, ...entry.mitigation, entry.verification]
  return [entry.title, entry.failure_mode, ...(entry.retrieval_aliases ?? [])]
}

function matchMetadata(entry, query, matchedTokens, confidence) {
  const normalized = String(query).trim().toLowerCase()
  const fields = ['exact_artifact', 'identifier', 'stack_version', 'behavioral', 'lexical']
  const matchedFields = fields.filter(field => {
    const candidates = values(entry, field)
    if (['exact_artifact', 'identifier'].includes(field)) return normalized.length >= 4 && candidates.some(value => {
      const candidate = String(value).toLowerCase(); return normalized.includes(candidate) || candidate.includes(normalized)
    })
    const fieldTokens = [...new Set(tokenize(candidates.join(' ')))]
    return matchedTokens.some(token => fieldTokens.some(candidate => related(token, candidate)))
  })
  const matchType = matchedFields.includes('exact_artifact') ? 'exact-artifact'
    : matchedFields.includes('identifier') ? 'identifier'
      : matchedFields.includes('stack_version') ? 'stack-version'
        : matchedFields.includes('behavioral') ? 'behavioral'
          : confidence < 0.5 ? 'weak-lexical' : 'lexical'
  return { match_type: matchType, matched_fields: matchedFields }
}

// BM25 (Okapi) term weighting -- see prd/09-retrieval-robustness-at-scale.md. Replaces the prior
// unweighted 1/documentFrequency specificity sum, which had no term-frequency or document-length
// component and produced a measured 0.000-margin tie at 23 patterns (ties get worse, not better, as
// the corpus grows and vocabulary buckets densify -- see the PRD for the actual measurement). This is
// a pure statistical improvement: no model call, no new dependency, no network access, computed
// entirely from the existing corpus at request time.
const BM25_K1 = 1.5
const BM25_B = 0.75

function rawTokenCounts(text) {
  const counts = new Map()
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

export function rankEntries(entries, query, limit = 5) {
  const queryTokens = [...new Set(tokenize(query))]
  if (queryTokens.length === 0) return []
  const indexed = entries.map(entry => {
    const counts = rawTokenCounts(searchableText(entry))
    return { entry, haystackTokens: [...counts.keys()], counts, length: [...counts.values()].reduce((a, b) => a + b, 0) }
  })
  const avgDocLength = indexed.reduce((sum, d) => sum + d.length, 0) / (indexed.length || 1)
  const documentFrequency = token => indexed.filter(({ haystackTokens }) => haystackTokens.some(candidate => related(token, candidate))).length
  const termFrequency = (queryToken, counts) => [...counts.entries()].reduce((sum, [docToken, n]) => sum + (related(queryToken, docToken) ? n : 0), 0)

  return indexed.map(({ entry, haystackTokens, counts, length }) => {
    const matched = queryTokens.filter(token => haystackTokens.some(candidate => related(token, candidate)))
    const relevance = matched.reduce((score, token) => {
      const tf = termFrequency(token, counts)
      const df = documentFrequency(token)
      const idf = Math.log((indexed.length - df + 0.5) / (df + 0.5) + 1)
      const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (length / (avgDocLength || 1)))
      return score + idf * (tf * (BM25_K1 + 1)) / (denom || 1)
    }, 0)
    const confidence = matched.length / queryTokens.length
    return { entry, confidence, matched_tokens: matched, specificity: Number(relevance.toFixed(3)), ...matchMetadata(entry, query, matched, confidence) }
  }).filter(result => result.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence ||
      b.specificity - a.specificity ||
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
