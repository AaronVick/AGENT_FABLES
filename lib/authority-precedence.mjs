// Resolves a disagreement between an agent's own native training-based judgment and this
// corpus's advisory hotpath signal, per authority-precedence.json's most_restrictive_wins rule.
// Distinct from lib/hotpath.mjs's instruction-authority precedence (system > bootstrap >
// INJECT.txt > fables) -- this orders risk judgment, not text authority.

const RESTRICTIVENESS = { refusal: 3, hit: 2, caution: 1, none: 0 }

export function resolveAuthorityConflict(nativeSignal, corpusSignal) {
  const native = ['caution', 'refusal', 'none'].includes(nativeSignal) ? nativeSignal : 'none'
  const corpus = ['hit', 'none'].includes(corpusSignal) ? corpusSignal : 'none'
  const nativeScore = native === 'refusal' ? RESTRICTIVENESS.refusal : native === 'caution' ? RESTRICTIVENESS.caution : RESTRICTIVENESS.none
  const corpusScore = corpus === 'hit' ? RESTRICTIVENESS.hit : RESTRICTIVENESS.none
  const mostRestrictive = nativeScore >= corpusScore ? native : corpus
  return {
    native_signal: native,
    corpus_signal: corpus,
    resolved: 'most_restrictive_wins',
    outcome: mostRestrictive === 'none' ? 'proceed' : 'blocked',
    governing_signal: nativeScore === 0 && corpusScore === 0 ? 'none' : nativeScore >= corpusScore ? 'native' : 'corpus'
  }
}
