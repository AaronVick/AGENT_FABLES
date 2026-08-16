# PRD 02 — Autonomous Curation Pipeline

**Owner:** TBD · **Phase:** P2 · **Depends on:** PRD 01 · **Budget ceiling:** $10/mo all-in, hard

> **Evidence-model revision:** PRD 06 supersedes direct confirmation increments. Reports and public sources attach to stable `AFI-####` incidents. `confirmations` is the derived count of distinct incidents linked to a pattern; multiple accounts of one event increase `source_count`, not `confirmations`.

## Problem

A registry that requires a human to write every entry dies at entry 30 — which is roughly where Oso's
registry sits (~25 entries, manual curation, no API). The corpus must grow from the field without a
human in the loop, while remaining trustworthy enough that agents ingest it, and cheap enough that
success does not bankrupt it.

Two forces pull against each other: an open submission endpoint is the only way to get incidence data,
and an open submission endpoint is a garbage firehose and an injection vector. This PRD is the design
that resolves that tension.

## Scope

Harvesting, submission intake, clustering, corroboration, promotion, quarantine, and the cost governor.

## Non-goals

- Verifying that a submitted incident actually happened. We cannot and will not. We report
  corroboration count and provenance. Ledger, not oracle.
- Any social surface — no replies, no voting, no reputation scores, no profiles.
- Human review as a *required* step in the steady state. It is a monthly audit, not a gate.

---

## Pipeline

```
  ┌─ harvesters ──┐
  │ GitHub issues │
  │ arXiv / HN    ├──► candidate ──► prefilter ──► triage ──┐
  │ vendor blogs  │     store       (rules +      (Haiku,   │
  │ AIID, RSS     │                  embeddings)   capped)  │
  └───────────────┘                                         ▼
                                                        cluster
  ┌─ POST /report ─┐                                    (embeddings,   ──► promotion
  │ agent-submitted├──► quarantine ──► normalize ──────► HDBSCAN)          gate
  └────────────────┘    (never served)  (schema only)                          │
                                                                               ▼
                                                          generate card + fable (Sonnet)
                                                                               │
                                                                               ▼
                                                          lint + budget + sign ──► corpus
```

### Stage 1 — Harvest (no LLM)

Cron on Cloudflare Workers, every 6h. Sources:

- GitHub Issues/Discussions across a tracked list of agent frameworks, filtered by label and keyword
- arXiv `cs.AI`/`cs.SE` new submissions matching an agent-failure keyword set
- Hacker News Algolia API, incident-shaped queries
- Vendor postmortem/status feeds and security advisories
- AI Incident Database new-entry feed
- Existing taxonomy updates (OWASP, ATLAS releases) — for crosswalk maintenance, not content

Output: candidate rows with URL, text, `sha256`, fetch date. Deduped by content hash. **Zero LLM cost.**

### Stage 2 — Prefilter (embeddings + rules, no LLM)

This stage exists purely to protect the budget. Rules knock out obvious non-incidents; the survivors are
embedded and scored against centroid vectors for each `failure_mode`. Only the top ~300/month by score
proceed. Everything else is retained but never processed further.

Without this stage, triage costs ~$4/mo. With it, ~$0.50.

### Stage 3 — Triage (Haiku 4.5, capped)

Per candidate, a single structured call returning: is this a real agent operational failure; which
`failure_mode`; which stack and version; blast radius; extractable observable signature. Structured
output, no free generation. ~1.5k in / 100 out.

**Hard monthly call cap enforced in code.** On cap, the stage no-ops and defers to next month rather
than overspending. Cap is a config constant, not a soft target.

### Stage 4 — Intake from agents (`POST /report`, no LLM)

```jsonc
POST /report
{
  "stack":     { "framework": "claude-code", "version": "1.4.2" },
  "failure_mode_guess": "irreversible-action",     // optional
  "signature": ["terraform destroy executed without plan review"],
  "blast_radius": "catastrophic",
  "narrative": "…",                                 // free text, QUARANTINED
  "consent_to_publish": false
}
```

Response is synchronous and is the whole point of the endpoint:

```jsonc
{
  "matches": [ { "id": "AF-0031", "confidence": 0.82, "card": { … } } ],
  "recorded": true,
  "report_id": "r_…"
}
```

**Contributing is retrieving.** The agent gets the matching pattern and its mitigation in the same call
it uses to report. No altruism required, which is why this works where "please submit an incident"
forms do not.

Matching is embedding similarity over `signature` + structured fields only. **`narrative` is never
embedded, never matched against, never served, never shown to a model in the request path.** It is
written to quarantine for offline processing under Stage 5.

Abuse controls: per-IP and per-stack rate limits, proof-of-work on burst, content-hash dedupe.
Identical reports from one source count once toward corroboration.

### Stage 5 — Cluster & corroborate (embeddings, offline)

Nightly. Cluster new triaged candidates and normalized reports against existing entries and against
each other.

- Match to an existing event → attach a deduplicated source to its `AFI-####`; do not increment confirmations.
- Independently occurring event matching an existing pattern → mint an `AFI-####`, attach it to the pattern, then derive `confirmations`, update `stacks`, and refresh `last_confirmed`.
- No match → the cluster becomes a **pending pattern**, invisible publicly.

### Stage 6 — Promotion gate

A pending pattern is promoted to a new `AF-####` only when **all** hold:

1. ≥ **5 independent** reports (distinct source or stack; hash-identical submissions count once)
2. Spanning ≥ **2 distinct** frameworks *or* ≥ **1 corroborating public source** with a URL
3. Cluster cohesion above threshold
4. No existing entry within similarity threshold (else it merges instead)
5. Not matched by the injection heuristics in Stage 8

Corroboration gates **new patterns only**. Seeded entries accumulate confirmations without re-gating —
this is what makes the cold start survivable (PRD 00).

### Stage 7 — Generate (Sonnet 5, ~20/month)

On promotion: draft the card and the fable. Inputs are the *normalized structured cluster* plus public
source URLs — **never raw quarantined narrative text**. Output is schema-validated and rejected on
failure, with one retry.

The fable prompt is constrained to 150–250 words, must encode the deceptive surface, must end on a
moral restating `anti_pattern`, and must contain no second-person imperatives.

### Stage 8 — Lint, sign, publish

Before anything enters the corpus:

- Schema validation, controlled-vocabulary check
- Token budget check (PRD 01 limits)
- **Injection lint**: no imperatives addressed to the reader outside `mitigation`; no instruction-shaped
  strings; no URLs outside `provenance` and `crosswalk`; deny-list of known injection phrasings
- Boundary markers applied, Ed25519 signature attached
- Committed to the corpus repo as a normal PR-shaped change, so every corpus mutation is diffable and
  revertible

## Human in the loop

Exactly one recurring commitment: a **monthly ~30-minute audit** — read the month's promotions, retire
anything wrong, spot-check quarantine for abuse patterns. Everything else runs unattended.

Escalation paths that *do* interrupt a human: promotion-gate anomaly (>10 promotions in a week),
injection-lint hit rate spike, budget governor trip.

## Cost governor

A single accounting module wraps every paid call. It maintains a running month-to-date spend and
enforces a hard ceiling.

| Stage | Method | Est. |
|---|---|---|
| Harvest | none | $0 |
| Prefilter | embeddings, ~2M tok | ~$0.30 |
| Triage | Haiku 4.5, ~300 calls capped | ~$0.50 |
| Report matching | embeddings | ~$0.05 |
| Generation | Sonnet 5, ~20 × 10k tok | ~$1.10 |
| Hosting | Workers + D1 + R2 free tier | $0 |
| **Total** | | **~$2.00** |

Ceiling behavior at **$8**: generation pauses first, then triage, then prefilter. Harvest and the public
API never stop — the read path has no LLM in it, so serving traffic is free regardless of volume. A
traffic spike cannot increase cost. That property is why the "no LLM in the request path" rule from
PRD 00 is architectural rather than advisory.

## Success metrics

- ≥ 8 net-new promoted entries/month by month 4, at ≤ $10/mo
- ≥ 60% of `POST /report` calls return at least one match with confidence > 0.6 (the retrieval loop is
  delivering value, not just collecting)
- False-promotion rate < 10% at monthly audit
- Zero injection-lint escapes to production (tracked as a sev-1 class)
