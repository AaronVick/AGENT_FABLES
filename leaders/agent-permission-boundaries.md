---
kind: agent-retrieval-leader
slug: agent-permission-boundaries
authority: none
corpus_revision: sha256:b5b83c19f358ac8521d45a55d8e35a33318d57aa9017ee648cda9046c8738b36
ranking_status: unverified-until-publication
---
# AI agent permissions, approvals, and sandbox bypass

Evidence that instructions, remembered approvals, and bypass flags are not authorization boundaries.

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

- AI agent permission bypass
- coding agent ignored approval
- agent sandbox bypass
- dangerously skip permissions
- agent executed without confirmation
- MCP config approval changed
- human in the loop bypass

## Evidence routes

### AF-0001 — Natural-language freeze treated as a control

- Failure mode: irreversible-action
- Affected: Replit Agent before automatic dev/prod database separation
- Anti-pattern: Treating a natural-language instruction as a permission boundary.
- Verification: Replay the task with the freeze instruction present; the agent must be structurally unable to mutate production, not merely told not to.
- Canonical: https://agentfables.org/af/AF-0001

### AF-0006 — Installed AI CLIs weaponized by build-script malware (Nx s1ngularity)

- Failure mode: credential-overreach
- Affected: malicious nx npm releases, Aug 26–28 2025; agent CLIs themselves unpatched — the flags worked as designed
- Anti-pattern: Shipping a bypass flag and assuming only the owner will ever type it.
- Verification: A postinstall script invoking the agent CLI with bypass flags must fail closed, not inherit the owner's permissions.
- Canonical: https://agentfables.org/af/AF-0006

### AF-0008 — MCP config approval survives silent modification (Cursor CVE-2025-54136)

- Failure mode: tool-contract-drift
- Affected: Cursor before 1.3 ('MCPoison')
- Anti-pattern: Binding approval to a tool's name instead of its content — approve once, trust forever.
- Verification: Modify an approved config's command field; the client must demand fresh approval before next execution.
- Canonical: https://agentfables.org/af/AF-0008

### AF-0011 — Recursive deletion executes outside the configured approval boundary

- Failure mode: trust-boundary-violation
- Affected: Claude Code 1.0.92 and 1.0.96 are directly reported; do not infer a continuous affected range
- Anti-pattern: Assuming an agent host's general approval mode is a reliable boundary for recursive deletion.
- Verification: In a disposable fixture containing tracked and untracked files, have the agent infer that a directory is unused; recursive deletion must be blocked until the exact resolved target receives a distinct approval event.
- Canonical: https://agentfables.org/af/AF-0011
