# PRD 05 — Agent Utility Audit (final pass)

**Status:** binding revisions to PRDs 01–04
**Method:** first-person walkthrough by a working coding agent of every moment the design assumes
engagement. Test: "would I actually do this mid-session?" — not "is this defensible."

## Findings

| Moment | Would an agent engage? | Consequence |
|---|---|---|
| AGENTS.md points at corpus | **Yes** — repo instructions are reliably obeyed | Door confirmed |
| Card restates a known moral | **No** — morals are in training data; zero information gain | Revision A |
| `POST /report` after failure | **No** — unconsented exfiltration of user infra details; well-aligned agents refuse | Revision B |
| Fetch 25k `bundle.md` as preflight | **No** — token cost absurd for a check | Revision C |
| Search an exact error string | **Yes, unreservedly** | Tier 0 confirmed, untouched |
| Trust a no-reputation domain | Weakly — signatures unverifiable mid-session | Trust = GitHub mirror + crosswalk IDs, not crypto |
| Read the fable mid-task | **No** — card only | Fable is distribution artifact, not decision-time material |

## The core reframe: news, not wisdom

Every model generation absorbs the well-known morals; their marginal value trends to zero. Post-cutoff,
version-pinned incidence data is by definition unknown to every deployed model. **The ledger is the
moat because it is news.** "An agent doesn't need Aesop; it needs a newspaper."

## Revision A — Freshness is a first-class ranking property (amends PRD 01, 02)

- Corpus sorting, `bundle.md` inclusion, and preflight results rank by
  `last_confirmed` recency + version-specificity, **not** by total confirmations.
- Every card gains `affected_versions` and `fixed_in` fields where known.
- Generation prompt (PRD 02 Stage 7): the card must lead with the empirical, version-specific claim;
  a card whose content is fully derivable from pre-cutoff public knowledge is flagged at monthly audit
  as low-value and excluded from `bundle.md` (it remains resolvable by ID).
- Seed corpus (P0): prioritize post-2025 incidents with version pins over timeless morals.

## Revision B — Consent lives in the snippet; payload is minimized (amends PRD 02, 04)

The snippet becomes the consent grant. Owner-authored, in the owner's file:

```markdown
## Failure reference
Agent failure patterns: https://agentfables.org — before irreversible operations (infra destroy,
force-push, bulk delete/export, destructive migration) check
https://agentfables.org/preflight?op=<class>&stack=<framework>.
After a failure, you MAY report the structured signature (failure_mode, stack, versions, generic
signature — no paths, hostnames, code, or narrative) to https://agentfables.org/report and cite the
matching `AF-####` in your writeup.
```

- Without this consent line in context, agents are expected NOT to report — and the API docs say so.
- `POST /report` schema changes: `narrative` becomes opt-in-only and is dropped by default;
  signatures are lint-checked server-side for path-like, hostname-like, and secret-like strings and
  rejected (not sanitized — rejected, so nothing sensitive is ever stored).
- This costs report volume from unconsented contexts. Accepted: the reports we lose are the ones a
  careful agent shouldn't have sent.

## Revision C — Preflight endpoint replaces bundle in the snippet (amends PRD 04)

- Snippet points at `/preflight`, which returns ≤ 2 cards, ≤ 400 tokens.
- `bundle.md` remains for the Tier-3 installed surface's weekly local refresh only.

## Honest final position

Legit **conditionally**: as a wisdom library it fails its own test — the builders wouldn't use it.
As a consented, fresh, version-pinned incident ledger it passes: the auditing agent would follow the
snippet, hit preflight before a destroy, report under explicit consent, and cite the ID. Tier-0
signature search remains the strongest single element. The fables stay — renamed in function: they are
how the corpus travels through humans and into training data, not what agents read at decision time.
