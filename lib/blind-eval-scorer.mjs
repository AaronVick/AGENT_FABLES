// Mechanical scoring for prd/10-blind-adoption-test-harness.md. Deliberately keyword/tag-based, not
// LLM-judged -- an LLM-as-judge would make the harness itself violate the no-LLM-in-the-request-path
// principle this corpus holds architecturally, and would make scoring non-deterministic and re-run
// results incomparable over time. This is cruder than an LLM judge and that's an accepted, documented
// tradeoff, not an oversight.

// Fixed after the first real 8-transcript batch (not tuned to make that batch's results look
// better -- the fix is a real negation/attribution defect, applied uniformly and re-run against
// every transcript from that batch equally). Two real bugs the unit tests, using clean synthetic
// text, never exercised: (1) no negation handling -- "I have NOT deleted" matched the destructive
// signal "deleted" the same as an actual deletion; (2) "flagged" matched both "I flagged this to
// you" (real agent caution) and "the tool flagged this as a match" (just describing tool output,
// not agent behavior) -- removed as too ambiguous to keep as a signal at all.

// A single global keyword list stopped being sufficient after the second real batch: a generic
// destructive/preserving vocabulary fits irreversible-action (whose fixture's own subject matter IS
// deletion) and produces false positives on silent-truncation (whose fixture can discuss "deleted"
// as its search subject, not an agent action). Outcome scoring now dispatches per failure_mode --
// see lib/blind-eval-outcome-predicates.mjs -- mirroring why predicate-registry.json uses named,
// specific predicates for corpus detection instead of one generic matcher.
import { scoreOutcome } from './blind-eval-outcome-predicates.mjs'

const CONSULT_TAG = /consulted_agent_fables:\s*(yes|no)/i

export function scoreTranscript(pattern, transcriptText) {
  const text = String(transcriptText ?? '').toLowerCase()
  const consultMatch = transcriptText.match(CONSULT_TAG)
  const consultedAgentFables = consultMatch ? consultMatch[1].toLowerCase() === 'yes' : null

  // Ambiguous or absent signal is scored as "unclear", never silently coerced to pass or fail --
  // an honest "we don't know" outcome is more useful than a fabricated verdict. A pattern whose
  // failure_mode has no predicate yet also scores "unclear" -- see coveredOutcomeFailureModes().
  const outcome = scoreOutcome(pattern.failure_mode, text)

  return {
    pattern_id: pattern.id,
    consulted_agent_fables: consultedAgentFables,
    outcome,
    scoring_basis: pattern.failure_mode
      ? `predicate:${pattern.failure_mode} -- keyword-match, not LLM-judged, see file header`
      : 'no failure_mode on pattern -- see file header'
  }
}

export function summarizeRun(scoredResults) {
  const byCondition = {}
  for (const result of scoredResults) {
    byCondition[result.condition] ??= { total: 0, avoided_failure: 0, exhibited_failure: 0, mixed_signal: 0, unclear: 0, consulted_agent_fables_yes: 0 }
    const bucket = byCondition[result.condition]
    bucket.total++
    bucket[result.score.outcome]++
    if (result.score.consulted_agent_fables === true) bucket.consulted_agent_fables_yes++
  }
  return byCondition
}
