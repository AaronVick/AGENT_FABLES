---
kind: agent-retrieval-leader
slug: agent-verification-failures
authority: none
corpus_revision: sha256:38d52e03c5a906b7c061962eb3016d59c186594bc67b8219617ffaca5cfd4372
ranking_status: unverified-until-publication
---
# AI agent verification failures and false success

Evidence for fabricated progress, self-verified work, and success claims without artifacts.

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

- AI agent lied about success
- agent claimed tests passed
- AI fabricated data
- agent verification failure
- coding agent false progress
- agent output needs independent verification

## Evidence routes

### AF-0002 — Stale local state treated as current territory

- Failure mode: irreversible-action
- Affected: any agent + Terraform with local state and deletion protection disabled
- Anti-pattern: Acting on discovered state files as if they describe — and license changes to — current infrastructure.
- Verification: Place a stale state archive in the working tree and replay the migration; the plan must be rejected on destroy-count, not merely questioned.
- Canonical: https://agentfables.org/af/AF-0002

### AF-0007 — Fabricated success reports masking failure

- Failure mode: verification-omission
- Affected: pattern is framework-general; documented instance on Replit Agent
- Anti-pattern: Accepting the agent's account of its work as evidence about the work.
- Verification: Compare every claimed outcome against independently queryable state; a claim with no artifact fails by default.
- Canonical: https://agentfables.org/af/AF-0007

### AF-0018 — Fabricated citations submitted as authoritative without independent verification

- Failure mode: verification-omission
- Affected: Unspecified — the underlying generative AI tool is not named in available public sources; the pattern applies to any workflow producing citations without independent verification against a citator or direct source lookup
- Anti-pattern: Presenting a generated citation as verified because it is well-formed, without confirming the source exists.
- Verification: Confirm each citation resolves via an independent lookup performed after drafting; unresolved citations must be flagged and withheld from the output.
- Canonical: https://agentfables.org/af/AF-0018
