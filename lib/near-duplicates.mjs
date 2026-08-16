import { tokenize, searchableText } from './retrieval.mjs'

// Generalizes overlaps.json's hand-maintained pairs (3 entries, authored by inspection) into a
// build-time check that scales past what a human can eyeball as the corpus grows. Jaccard similarity
// over token sets -- cheap, deterministic, zero-LLM, appropriate for doc-vs-doc comparison (BM25 in
// lib/retrieval.mjs is a query-vs-doc measure and doesn't directly generalize to this).
function jaccard(a, b) {
  const setA = new Set(a), setB = new Set(b)
  const intersection = [...setA].filter(token => setB.has(token)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

export function findNearDuplicates(entries, threshold = 0.35) {
  const tokenSets = entries.map(entry => [...new Set(tokenize(searchableText(entry)))])
  const pairs = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = jaccard(tokenSets[i], tokenSets[j])
      if (similarity >= threshold) {
        pairs.push({ ids: [entries[i].id, entries[j].id].sort(), similarity: Number(similarity.toFixed(3)) })
      }
    }
  }
  return pairs.sort((a, b) => b.similarity - a.similarity)
}

export function undocumentedNearDuplicates(entries, overlapsPairs, threshold = 0.35) {
  const documented = new Set(overlapsPairs.map(pair => [...pair.ids].sort().join('|')))
  return findNearDuplicates(entries, threshold).filter(pair => !documented.has(pair.ids.join('|')))
}
