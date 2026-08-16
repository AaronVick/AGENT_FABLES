// Answers a question this corpus's own core lesson (AF-0025: incomplete search is not
// proof of absence) applies to itself but never actually surfaced: when af_tool_preflight
// returns match=none, was that because the corpus evaluated this tool and found nothing,
// or because this tool has never been considered at all? Those are different confidence
// levels and the existing receipt shape (additionalProperties=false, see
// schemas/hotpath-receipt.schema.json) can't carry a new field without a schema
// migration, so this ships as a separate, additive check rather than touching that path.

export function computeCoverage(toolRules, retrievalRules, tool) {
  const canonical = String(tool ?? '').toLowerCase().trim()
  const matchingRules = [...toolRules, ...retrievalRules].filter(rule => String(rule.tool ?? '').toLowerCase() === canonical)
  if (matchingRules.length === 0) {
    return {
      coverage: 'no_coverage',
      rule_count: 0,
      meaning: 'This corpus has never written a rule referencing this tool name. A match=none here carries no evidentiary weight either way -- it is silence, not an evaluation.'
    }
  }
  return {
    coverage: 'evaluated_no_match',
    rule_count: matchingRules.length,
    pattern_ids_considered: [...new Set(matchingRules.flatMap(rule => rule.ids))].sort(),
    meaning: 'This corpus has rules for this tool and none fired for the specific call. Stronger than no_coverage, but still not evidence of safety -- see the existing absence-of-match disclaimer.'
  }
}
