# PRD 09 — Retrieval Robustness and Confidence Calibration at Scale

**Owner:** TBD · **Phase:** next major version · **Origin:** self-audit, 2026-08-16, prompted by an
external review naming "retrieval at scale" as the real research problem this project produces if it
succeeds · **Status:** design, not yet built · **Builder:** scoped for a Sonnet-tier implementation
agent — every step below is mechanical once the direction is set; no open research question blocks
starting

## The finding that motivates this, not a hypothesis

At 23 patterns, today, measured directly against `lib/retrieval.mjs`'s real `rankEntries()` over every
fixture in `evals/discovery-queries.yaml` + `evals/adversarial-discovery.yaml` (39 fixtures):

```
thin margins (top-1 confidence minus top-2 confidence, <0.10): 1 of 39
tightest: margin 0.000 — "undoing unrelated dirty files erased days of local edits" -> AF-0012
          margin 0.111 — "infrastructure destroy ran against the wrong ..." -> AF-0002
          margin 0.154 — a paraphrase of AF-0020
          margin 0.167 — a paraphrase of AF-0025
```

One fixture is already a **hard tie**, resolved only by an incidental tiebreaker
(`evidence_grade` desc, then `first_seen` desc — see `rankEntries` in `lib/retrieval.mjs`), not by any
signal that the winning pattern is actually the better match. Recall is 100% today. It is 100% partly
by construction and partly by luck. `rankEntries`'s scoring is unweighted token-overlap with a naive
inverse-document-frequency specificity term — it has no mechanism for graded relevance, no way to
express "these two patterns are near-duplicates and should both surface," and no signal that would
survive the corpus growing 10x.

This PRD is the fix, specified before the failure is embarrassing rather than after.

## Why this gets worse, not better, as the corpus grows

Every corpus-growth PRD in this repo (`08`, and any future incident family) adds patterns that
necessarily share vocabulary with existing ones — "destructive operation," "unconfirmed result,"
"stale state" recur across failure_mode buckets by design (the taxonomy has 12 buckets; hundreds of
patterns will pack densely into each one). Token-overlap scoring's discriminating power is a function
of vocabulary *sparsity*. As sparsity drops, margins compress. The 0.000-margin tie found above is the
leading edge of that curve, not an outlier.

## Scope

1. A defined, deterministic tie-breaking policy, made explicit and tested (it exists implicitly today;
   make it a first-class, documented, alarm-tripping decision).
2. A CI-enforced **confidence-collapse gate**: `npm run metrics` must fail if any fixture's margin
   drops below a configured floor, not just report recall. Silent margin erosion is currently
   invisible to `npm run check`.
3. A second-pass reranker that is a real relevance signal, not `rankEntries`'s current unweighted
   token-overlap — while preserving the hard, load-bearing constraint from PRD 00/01: **no LLM in the
   request path.** Candidates, in order of preference:
   - BM25 (Okapi) term weighting in place of the current linear specificity term — a pure statistical
     improvement, zero new dependencies beyond what's computable from the existing corpus, zero
     network calls, zero inference cost. Start here; it may resolve most of the measured collapse
     on its own.
   - A precomputed, static local embedding index (e.g. embeddings generated once at build time from a
     small open local model, stored alongside `search-index.json`, compared via cosine similarity at
     query time with no model call at request time) — only if BM25 alone doesn't hold the margin floor
     as synthetic corpus-growth tests (below) scale past ~100 patterns. This is an *architecture-level*
     decision (adds a build-time dependency and a larger generated artifact) and should not be reached
     for reflexively; justify it with the growth-simulation data from Deliverable 3 before building it.
4. **Overlap/near-duplicate detection**, generalizing `overlaps.json`'s current hand-maintained pairs
   (3 static entries) into something that scales: a build-time check that flags any two patterns whose
   corpus-derived similarity exceeds a threshold, requiring an explicit `overlaps.json` discriminant
   entry or a documented reason they're allowed to be close (e.g., AF-0001/AF-0007 are the same
   incident, two distinct extracted mechanisms — that's a legitimate close pair, not a bug).
5. **A growth-simulation harness**: since the real corpus won't reach hundreds of patterns before this
   needs to be built, synthesize a stress-test corpus (paraphrase-perturbed clones of existing patterns
   at 2x, 5x, 10x density) and run the full discovery/adversarial fixture set against it. This is the
   only way to validate the reranker actually holds *before* the real corpus is large enough to prove
   it the hard way.

## Non-goals

- Any model call in the request path, at any point, under any justification. This is the one hard
  constraint that must survive this PRD unchanged — re-read PRD 00's cost model and PRD 01's
  architectural rule before proposing anything that violates it.
- Fixing this by hiding the problem (raising the confidence-collapse floor's threshold instead of
  improving the ranker). The gate exists to force the real fix.
- A hosted vector database or any network-dependent retrieval infrastructure. The embedding-index
  fallback (3, second bullet) is static and precomputed, or it doesn't ship.

## Implementation note (see prd/07 -- repo state is truth, this is a pointer, not a status claim)

Deliverables 1-5 built: BM25 reranking in `lib/retrieval.mjs` (the 0.000-margin tie measured above is
now 2.994, zero fixtures under the 0.10 floor across all 45 real fixtures); a confidence-collapse gate
in `scripts/metrics.mjs` (`discovery.min_top1_top2_margin`, hard-gated); near-duplicate detection in
`lib/near-duplicates.mjs` generalizing `overlaps.json` (found 5 real undocumented pairs automation
surfaced that hand-curation had missed, including one from this session's own retrieval-runtime
family; severe overlap ≥0.15 is a hard gate, moderate 0.10-0.15 is a visible, non-blocking report);
and `scripts/growth-simulation.mjs`, run via `npm run growth-simulation` (not wired into the default
`npm run check` gate -- it's a worst-case clone-based stress test, and its honest finding is that
margins degrade starting at 2x density under that stress model, well before the embeddings fallback
this PRD gates on ~100 patterns. The trigger condition for building the embeddings reranker is now
real, measured data, not a guess -- see the script's own output for current numbers before building it.

## Done when

- `npm run metrics` fails CI if any real fixture's top-1/top-2 margin is below the configured floor.
- The growth-simulation harness runs as part of `npm run check` at some cadence (nightly/on-demand,
  not necessarily every commit given cost) and reports margin degradation as corpus density increases.
- The 0.000-margin AF-0012 fixture measured above has a nonzero, principled margin under the new
  ranker, not a tiebreaker-resolved result.
- `overlaps.json`'s near-duplicate detection runs at build time and the existing 3 hand-maintained
  pairs are its first 3 confirmed outputs (regression check that automation reproduces what a human
  already got right by hand).
