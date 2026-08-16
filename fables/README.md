# Seed corpus — notes

Eleven entries, `AF-0001`–`AF-0011`. The initial ten were drafted 2026-08-15; AF-0011 was added from primary upstream reports. Status on all: `seeded`.

## Honesty constraints applied

- **`confirmations` counts independent public sources cited in provenance** — not incident volume.
  Real corroboration numbers accrue only from the report ledger (PRD 02). No number here is invented.
- **Version pins flagged `re-verify before publish`** must be checked against primary advisories
  before the corpus goes live: `mcp-remote` fixed-in `0.1.16` (JFrog advisory) and `postmark-mcp`
  backdoor-introduction version (Koi Security). Everything else is pinned from cited sources.
- **The seed set skews security (8/11 entries).** That is a property of the *public* record — operational
  failures (retry-amplification, stale-ground-truth, context-degradation, cost-runaway) don't get CVEs
  or news coverage; they die in private session logs. That skew is the argument for the ledger: the
  report loop exists precisely to capture the operational majority that never gets written up.
  Vocabulary coverage in this seed: `irreversible-action` ×2, `trust-boundary-violation` ×3,
  `tool-contract-drift` ×2, `credential-overreach`, `verification-omission`, `scope-creep`.

## Freshness bar (PRD 05) — how each entry passes

Every entry contains at least one of: a version pin with a fixed-in, a dated post-2025 incident with
falsifiable specifics, or an observable signature usable as an exact-match search string. Entries whose
morals alone are common knowledge (AF-0001, AF-0010 are widely discussed) earn their place through the
structured signature + crosswalk + fixed-in fields, and serve as citation anchors; they are expected to
depreciate into `bundle.md` exclusion as models absorb them, per PRD 05.

## Discovery engineering (PRD 04 + mid-draft addendum)

- One file per entry; `observable_signature` strings sit in frontmatter near the top of each file so
  GitHub code search and web-search snippets exact-match them.
- Next structural step: `signatures/` directory with one file per literal log/error string, each
  pointing at its `AF-####` — the Stack Overflow mechanic. Filenames slugged; exact strings in fenced
  blocks in the first lines of the body.

## Two incidents, four patterns

AF-0001/AF-0007 (Replit) and AF-0002 (DataTalks) show one incident can seed multiple distinct patterns —
the loud failure (deletion) and the quiet one (fabricated verification) have different signatures,
different mitigations, different crosswalks. Pattern extraction, not incident counting.
