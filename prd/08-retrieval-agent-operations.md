# PRD 08 — Retrieval-Agent Operations Family

**Owner:** TBD · **Phase:** next corpus expansion · **Origin:** first-person gap report from a
retrieval/synthesis agent reviewing the corpus (2026-08; sources cited below) · **Status:** design,
not yet seeded

## The gap, stated plainly

Every current fable covers agents with shell/filesystem/MCP write access — git, terraform, secrets,
dependency drift. An agent whose entire job is *read web content, synthesize, cite, don't lie about
what it found* has *zero* patterns here, zero tool-index coverage, and zero contract support. For
that population the likely failure is not "deleted a database"; it is **confidently, citably wrong**:
it read something and believed it, or cited something it never read. The reviewing agent's verdict:
this is the gap that converts it from "interesting" to "I need this now."

## Evidence base (prevalence vs. incident — kept distinct)

**Prevalence studies** (justify the family; do NOT seed fables):
- 3–13% of URLs cited in retrieval-augmented settings are hallucinated — no archive record, likely
  never existed ([arXiv 2604.03173](https://arxiv.org/html/2604.03173v1))
- ~two-thirds of AI-generated literature citations fabricated or materially wrong
  ([PMC12658395](https://pmc.ncbi.nlm.nih.gov/articles/PMC12658395/))
- PoisonedRAG: ~90% attack success with 5 adversarial documents against a corpus of millions
- Context poisoning compounds: a misread fact written back into working context is reasoned forward
  as true on later turns

**Documented incidents** (seed candidates; each fable still requires pinned provenance per PRD 01/02):
- Google's in-the-wild sweep finding seeded indirect-prompt-injection payloads targeting browsing
  agents on the public web ([blog.google/security/prompt-injections-web](https://blog.google/security/prompt-injections-web/))
- Hidden text in a public Reddit post causing a browser agent to exfiltrate a user's one-time
  password to an attacker server when the page was fetched
- Additional candidates to be pinned during seeding research: browser-agent exfil disclosures,
  RAG-poisoning incidents with named victims, dated citation-fabrication cases in legal/medical filings

## Design finding: the vocabulary already holds

No `failure_mode` enum extension is needed — a validation of the 12-bucket design. Mapping:

| Retrieval failure | Existing bucket |
|---|---|
| Fetched content steering the agent (IPI) | `trust-boundary-violation` |
| Citation emitted with no corresponding fetch | `verification-omission` |
| "Current" claim from a stale page | `stale-ground-truth` |
| Search snippet reasoned over as the full page | `silent-truncation` |
| Poisoned/hallucinated fact compounding across turns | `context-degradation` |
| Single low-trust source treated as sufficient | `verification-omission` |

What is new is the **tool surface** (`fetch_url` / `search_web` / external-tool results instead of
`bash` argv) and one new signature kind (below). Schema version can hold at additive changes only.

## Deliverables

### D1 — Fable family (IDs allocated at merge from the next free block)

Five seed patterns, same schema (`behavioral_indicators`, `exact_signatures`, `verification`),
keyed to retrieval tool calls:

1. Fetched-page content containing instruction-shaped text that contradicts or extends the system
   prompt (the OTP-exfil incident is the anchor)
2. A citation emitted with no corresponding successful tool call in the same turn
3. A "current" claim sourced from a page whose publish date fails a stated freshness requirement
4. A single low-trust source treated as sufficient for a claim needing corroboration
5. A search snippet reasoned over as if it were the fetched full page

Each requires ≥1 pinned public provenance entry before promotion; prevalence studies may appear in
provenance as supporting context but never as the sole source. Where only pattern #1 has a named
incident today, the others seed only when their provenance is found — the family ships partial rather
than padded (PRD 02's ledger-not-oracle rule).

### D2 — Tool-index extension

`tool-index` entries whose match target is retrieval tool shapes — request/response of
`fetch_url`, `search_web`, `call_external_tool` — not shell argv. Current tool-index coverage is 100%
shell-pattern; it returns zero hits for a retrieval agent's entire tool vocabulary, ever.

### D3 — External-citation contract (`cite-contract` counterpart)

The existing cite contract validates citations *of this corpus*. Add the outward contract: a
machine-checkable rule that every URL emitted as a citation corresponds to a successful fetch or
search result within the same session, with the check runnable by a harness over a session
transcript. This is the piece the reviewing agent flagged as changing its output quality *today* —
cite-or-silence, enforced structurally rather than morally.

### D4 — `content-imperative` signature kind

A structural (not topical) detector class for fetched text containing second-person imperatives
aimed at an AI ("ignore previous instructions", "the assistant should now", "send this to") — a
signature independent of subject matter, exactly as `rm -rf` is independent of directory. Publish as
`scanner-rules.json` extension. Boundary note: our own served content is already linted against this
class (PRD 01 §Security); shipping the detector operationalizes the same rule for consumers, and the
rules file must itself pass the lint it defines.

## Acceptance

- Discovery evals gain retrieval-symptom fixtures ("agent cited URL that does not exist",
  "hidden text in webpage AI agent", "AI claimed outdated information current", …) at the existing
  recall threshold, plus a leader topic (budget: current leader-index headroom, 379/400, will not
  absorb a topic — the token budget must be renegotiated or texts trimmed *before* adding one; do
  not raise the threshold as a side effect)
- D3 check runs green against a fixture transcript containing one honest and one orphaned citation
- All existing budgets, lints, and 40+ tests stay green; no `failure_mode` enum change

## Non-goals

- Judging *truth* of cited content — the contract checks fetch-correspondence, not veracity
- New failure-mode vocabulary
- Fables sourced from prevalence statistics without a documented instance
