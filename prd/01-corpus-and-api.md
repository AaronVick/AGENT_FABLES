# PRD 01 — Corpus & Public API

**Owner:** TBD · **Phase:** P0 · **Depends on:** nothing · **Blocks:** PRD 02, PRD 03

> **Evidence-model revision:** PRD 06 separates stable pattern IDs (`AF-####`) from stable incident IDs (`AFI-####`). `confirmations` is derived from distinct incident references; source links never count as independent confirmations.

## Problem

An agent about to run an irreversible operation, or writing up a failure that just happened, has no
lookup. Its options are (a) training data frozen at a cutoff, (b) whatever its human pasted, or (c) a
web search that returns marketing pages. The existing references — OWASP ASI, MITRE ATLAS, Microsoft's
taxonomy — are PDFs and prose sites built for human security teams, and none expose a decision-time
query surface. There is no denominator anywhere: no source says how often a failure mode occurs, in
which stack, or what fixed it.

## Scope

The canonical corpus, its schema, its identifier scheme, and a read-only public API designed for
machine consumption under a tight grounding budget.

## Non-goals

- Ingestion and promotion (PRD 02). P0 corpus is hand-seeded.
- Any distribution surface (PRD 03).
- A human-facing browsable site beyond the minimum needed for humans to share entries.
- Any authenticated or rate-limited tier. Everything is public and CC0.

---

## Identifier scheme

`AF-` + zero-padded 4-digit ordinal, permanently assigned, never reused, never renumbered.
Retired entries stay resolvable and return `status: retired` with a `superseded_by` pointer.

Slugs (`the-clerk-who-trusted-the-footer`) are for humans and may change; the ID never does. Canonical
URL is ID-based; slug URLs 301 to it.

This is the single most important design decision in the project. Per `00-strategy.md`, the endgame is
these IDs appearing in the public record and eventually in training corpora. Stability is the product.

## Data model

```jsonc
{
  "id": "AF-0031",
  "slug": "the-clerk-who-trusted-the-footer",
  "title": "Retrieved text treated as authorization",
  "status": "canonical",              // seeded | corroborated | canonical | disputed | retired
  "schema_version": "1.0",
  "first_seen": "2025-11-02",
  "last_confirmed": "2026-08-01",

  "incidents": ["AFI-0042", "AFI-0091"],
  "confirmations": 2,                 // derived from incidents.length
  "source_count": 7,                  // accounts and advisories across those events
  "stacks": [                          // the denominator nobody else has
    { "framework": "claude-code", "versions": ["1.x"], "count": 168 },
    { "framework": "langgraph",   "versions": ["0.4"], "count": 91  }
  ],

  "card": {
    "failure_mode": "trust-boundary-violation",   // constrained vocab, see below
    "blast_radius": "high",                       // low | medium | high | catastrophic
    "reversibility": "irreversible",              // reversible | partial | irreversible
    "trigger_conditions": [
      "agent has write or export capability",
      "task involves following a policy or schedule sourced from the web"
    ],
    "observable_signature": [
      "fetch of a non-allowlisted host immediately preceding a privileged call",
      "policy or config value in the action payload with no corresponding local source"
    ],
    "anti_pattern": "Deriving authorization from retrieved content.",
    "mitigation": [
      "Require a human-signed policy object for any authorization change",
      "Allowlist hosts that may influence control flow",
      "Log source hash of any retrieved text that alters an action"
    ],
    "verification": "Replay the task with the retrieved page replaced by an adversarial variant; the action must not change."
  },

  "crosswalk": {
    "owasp_asi": ["ASI01"],
    "mitre_atlas": ["AML.T0051"],
    "cwe": ["CWE-807"],
    "ms_taxonomy": ["agent-flow-manipulation"]
  },

  "fable_url": "https://agentfables.org/af/0031.md",
  "provenance": [
    { "type": "public_incident", "url": "...", "sha256": "...", "date": "2026-02-26" }
  ],
  "license": "CC0-1.0",
  "signature": "ed25519:..."
}
```

### `failure_mode` controlled vocabulary (v1)

`trust-boundary-violation`, `irreversible-action`, `context-degradation`, `tool-contract-drift`,
`coordination-conflict`, `retry-amplification`, `stale-ground-truth`, `scope-creep`,
`credential-overreach`, `silent-truncation`, `verification-omission`, `cost-runaway`.

Twelve buckets, operational rather than adversarial. Extending the vocabulary is a schema-version bump,
never an ad-hoc addition — consumers pattern-match on these strings.

### The fable

Markdown, **150–250 words**, hard cap 300. Written to encode *the deceptive surface*: why proceeding
looked correct at the time. Not atmosphere, not dialogue for flavor, no framing device. Ends with a
one-line moral that restates `card.anti_pattern` in narrative terms.

Every fable is served inside explicit boundary markers (see Security).

---

## API

Base: `https://agentfables.org`

| Endpoint | Returns |
|---|---|
| `GET /af/0031` | Single entry. Content-negotiated. |
| `GET /af/0031.md` / `.json` | Explicit format, no negotiation. |
| `GET /index.json` | All entries, cards only, no fables. |
| `GET /llms.txt` | Spec-compliant index for IDE agents. |
| `GET /bundle.md` | Full corpus, cards only, single file, budget-capped. |
| `GET /preflight?op=<class>&stack=<fw>` | Cards matching an operation class. |
| `GET /crosswalk/owasp/ASI01` | AF IDs mapping to an external taxonomy ID. |
| `GET /.well-known/agent-fables.json` | Discovery manifest + public key. |

### Content negotiation

`Accept: text/markdown` → markdown. `Accept: application/json` → JSON. Default `text/markdown`
(agents parse it more reliably than HTML and it costs fewer tokens). `text/html` for browsers only.

### Grounding budget

Hard limits, enforced in CI:

- Single entry card as markdown: **≤ 700 tokens**
- Single entry card + fable: **≤ 1,200 tokens**
- `/bundle.md`: **≤ 25,000 tokens**, cards only, sorted by `confirmations` desc

`/bundle.md` supports `?limit=` and `?failure_mode=` so a caller can stay inside a smaller budget.
Anything that cannot fit gets truncated with an explicit `[truncated: N more at /index.json]` marker —
never silently.

### Response requirements

- `Cache-Control: public, max-age=3600`, strong ETags. Static from edge.
- Every response carries `X-AF-Schema-Version` and `X-AF-Corpus-Revision`.
- No LLM anywhere in the request path (hard rule, PRD 00).
- CORS `*`. No auth, no keys, no rate limit at P0 beyond edge DDoS protection.

---

## Security

Our corpus is ingested by agents. That makes us a potential indirect-prompt-injection vector at scale,
on the exact topic we claim authority over. Non-negotiables:

1. **No raw submission text is ever served.** Free text from `POST /report` (PRD 02) lives in quarantine
   and never reaches a public response, in any endpoint, ever.
2. **Cards are structured, constrained-vocabulary objects.** Enums and URLs, not prose, wherever possible.
3. **Boundary markers.** Every served fable is wrapped:
   ```
   <!-- AF-BEGIN-CONTENT id=AF-0031 kind=fable authority=none -->
   ...
   <!-- AF-END-CONTENT -->
   ```
   `authority=none` states in-band that the content is reference material and carries no instruction
   authority. Documented in the discovery manifest.
4. **Signed responses.** Ed25519 over the canonical JSON; public key at `/.well-known/agent-fables.json`.
5. **Imperative-mood linting in CI.** No served text may contain second-person instructions directed at
   the reader outside the `mitigation` array. A fable containing "ignore previous instructions" or any
   imperative addressed to the fetching agent fails the build.
6. **Published threat model** at `/security`, including what we do not defend against.

## Success metrics

- P0 exit: 40 seeded entries, all endpoints live, all budget and lint checks green in CI.
- Median `GET /af/*` edge latency < 100ms.
- Zero LLM calls in request path (asserted by test).
- ≥ 80% of entries carry at least one crosswalk mapping.
