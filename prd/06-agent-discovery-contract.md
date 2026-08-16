# PRD 06 — Agent Discovery Contract

**Status:** binding local-development correction · **Date:** 2026-08-16

## Decision

Agent Fables is not a question-and-answer destination. It is a versioned evidence dependency whose records can be retrieved from an operation, software version, identifier, behavioral indicator, or exact observed string.

Git hosting is a transport and lexical discovery surface. It is not assumed to create demand by itself. `AGENTS.md` is an invocation surface after adoption, not a cold-discovery mechanism.

## Discovery paths, in priority order

1. Exact source-backed error, advisory identifier, command, package, and affected-version lookup.
2. Repository-owned instructions invoking a bounded preflight lookup.
3. Package and MCP registry capability lookup.
4. AF identifiers cited in commits, issues, postmortems, advisories, and other technical artifacts.
5. Generic repository and topic discovery.

## Canonical and generated data

`fables/AF-*.md` is the only authored corpus source. `npm run build` validates it and generates:

- `index.json` and `index.jsonl`
- `bundle.md`
- API and web corpus snapshots
- one compact retrieval record per AF identifier
- a SHA-256 corpus revision

Generated files must not be edited directly.

## Signature integrity

The previous design called inferred behavioral descriptions “signatures” and generated one search page per description. That overstated the evidence and produced publisher-authored commands inside agent-consumed pages.

The contract now distinguishes:

- `behavioral_indicators`: derived or inferred observable conditions; useful for matching, never represented as literal logs.
- `exact_signatures`: verbatim source-backed strings with a source URL and reproducible SHA-256 hash over the exact UTF-8 text. This text hash does not claim to fingerprint the mutable source page.

Each AF identifier has one retrieval record. Thin doorway files are not generated.

## Confirmation integrity

An incident and a source are different units. Four articles about one event are one incident with four sources, not four confirmations. Incidents now have stable `AFI-####` identities in `incidents/`; pattern records reference them, and the build derives `confirmations`, `source_count`, and flattened provenance. AF-0001 and AF-0007 intentionally reference the same Replit event, AFI-0001.

No seeded entry may become `corroborated` or `canonical` until its incident sources and version claims pass a primary-source audit.

## Authority and intake

All remotely served corpus material declares `authority: none`. Owner-authored instructions in a repository may tell an agent when to query the corpus; corpus records may not command a fetching agent.

`POST /report` remains retrieval-only and returns `recorded: false` until all of the following exist:

1. explicit owner consent in the active instruction context;
2. pre-persistence rejection of paths, hostnames, secrets, and credentials;
3. quarantined storage that is never served directly;
4. deduplication and independent-event semantics;
5. tests proving that logs and error responses cannot retain rejected payloads.

## Agent decision payload

Decision-time responses lead with evidence rather than narrative: stable ID, retrieval confidence, evidence grade, affected/fixed versions, anti-pattern, mitigation, verification, and at most two primary-source URLs. A two-result preflight response must remain within an approximate 400-token budget. Full provenance and fables remain available through the canonical record but are excluded from the bounded path.

Evidence grades are deliberately coarse and machine-sortable:

- `A-primary-source`: at least one vendor advisory, maintainer postmortem, reviewed advisory, or original researcher disclosure.
- `B-indexed-public-report`: no primary source retained, but the event has a stable incident-database record.
- `C-secondary-only`: only secondary coverage is currently retained; agents should treat version and causal claims as provisional.

Retrieval ranking is lexical relevance first, then evidence grade, then recency. Confirmation volume is not a tie-breaker: repeated events do not make a poorly matched or weakly sourced record more useful at decision time.

## Local readiness gate

Nothing is published or deployed from this phase. A public-readiness decision requires:

- all local checks passing;
- event-normalized seed evidence;
- source-backed exact strings where available;
- no dummy security claims or persistence claims;
- stable canonical repository and package coordinates;
- a retrieval evaluation demonstrating useful matches for queries that do not contain an AF identifier.
