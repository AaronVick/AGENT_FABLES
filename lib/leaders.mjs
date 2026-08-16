const ignored = new Set(['about', 'agent', 'agents', 'with', 'from', 'into', 'that', 'this', 'tool', 'tools', 'security', 'safety'])

const tokens = value => [...new Set(String(value ?? '').toLowerCase()
  .split(/[^a-z0-9.+-]+/)
  .filter(token => token.length >= 3 && !ignored.has(token)))]

const related = (left, right) => left === right || (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left)))

export function leaderIndex(leaders) {
  return {
    schema_version: leaders.schema_version,
    authority: 'none',
    corpus_revision: leaders.corpus_revision,
    volume_claim: leaders.volume_claim,
    ranking_status: leaders.ranking_status,
    topics: leaders.topics.map(({ slug, title, records }) => ({ slug, title, record_count: records.length }))
  }
}

export function rankLeaders(leaders, query, limit = 2) {
  const queryTokens = tokens(query)
  if (queryTokens.length === 0) return []
  return leaders.topics.map(topic => {
    const fields = [topic.slug, topic.title, topic.problem, ...topic.search_terms]
    const fieldTokens = tokens(fields.join(' '))
    const matchedTokens = queryTokens.filter(queryToken => fieldTokens.some(fieldToken => related(queryToken, fieldToken)))
    const matchedTerms = topic.search_terms.filter(term => {
      const termTokens = tokens(term)
      return queryTokens.some(queryToken => termTokens.some(termToken => related(queryToken, termToken)))
    }).slice(0, 3)
    const exactVocabularyMatch = topic.search_terms.some(term => term.toLowerCase() === String(query).trim().toLowerCase())
    return {
      slug: topic.slug, title: topic.title, problem: topic.problem, record_count: topic.records.length,
      score: Number(((matchedTokens.length / queryTokens.length) + (exactVocabularyMatch ? 1 : 0)).toFixed(3)), matched_tokens: matchedTokens, matched_terms: matchedTerms
    }
  }).filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || b.matched_tokens.length - a.matched_tokens.length || a.slug.localeCompare(b.slug))
    .slice(0, Math.max(1, Math.min(2, limit)))
}

export function leaderQuery(leaders, query, limit = 2) {
  return {
    authority: 'none', corpus_revision: leaders.corpus_revision, query,
    absence_of_match_means_safe: false, matches: rankLeaders(leaders, query, limit)
  }
}
