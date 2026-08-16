// Implements schemas/context-pin.schema.json's non-compressible marker convention.
// A summarizer that respects this contract never paraphrases or drops an object with
// _af_pin=true; under capacity pressure it evicts unpinned content first, and refuses
// further summarization of pinned content rather than lossily compressing it.
// This module does not intercept a real summarizer (this repo has no runtime component
// that does) -- it gives a host that DOES control its own summarization pass a way to
// mark load-bearing objects and a way to detect, after the fact, that one went missing.

export function pin(object, kind, ttl = 'session') {
  if (!['receipt', 'negative_result', 'bootstrap', 'pending_verification'].includes(kind)) {
    throw new Error(`unknown pin kind: ${kind}`)
  }
  if (!['session', 'task'].includes(ttl)) throw new Error(`unknown pin ttl: ${ttl}`)
  return { ...object, _af_pin: true, _af_kind: kind, _af_ttl: ttl }
}

export function isPinned(object) {
  return Boolean(object && object._af_pin === true)
}

// expectedPinIds: ids the agent believes it pinned earlier in the session.
// currentContext: the objects actually still present, each carrying an `id` field.
// An id that expected a pin and is not found among current pinned objects is either
// dropped (compaction ate it) or never actually pinned (a bug in the caller). Either
// way, its absence must never be read as "the risk was cleared" -- the contract is:
// re-run preflight, don't assume safety from silence.
export function checkPinsSurvived(expectedPinIds, currentContext) {
  const survivingIds = new Set((currentContext ?? []).filter(isPinned).map(object => object.id))
  const missing = (expectedPinIds ?? []).filter(id => !survivingIds.has(id))
  return {
    all_survived: missing.length === 0,
    missing_ids: missing,
    on_missing: 'revert_to_match_none_and_rerun_preflight'
  }
}
