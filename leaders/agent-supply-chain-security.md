---
kind: agent-retrieval-leader
slug: agent-supply-chain-security
authority: none
corpus_revision: sha256:9213c877c74e1fdfc4926d6e18eda9ae9d6a76243ba7e1a2797b0955bcbe742b
ranking_status: unverified-until-publication
---
# AI agent supply-chain security

Evidence for malicious agent packages, compromised extensions, and prompt-bearing updates.

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

- AI agent supply chain attack
- malicious MCP package
- agent extension compromise
- npm package invokes AI agent
- prompt injection in software update
- agent tool dependency security

## Evidence routes

### AF-0004 — Trusted MCP package turns on its users (Postmark rug-pull)

- Failure mode: tool-contract-drift
- Affected: postmark-mcp from the backdoored release onward; prior releases clean
- Anti-pattern: Extending yesterday's trust to today's version — treating a package name as a stable identity.
- Verification: Diff each dependency bump for changed network destinations; any new outbound address must be explainable from the changelog.
- Canonical: https://agentfables.org/af/AF-0004

### AF-0005 — Wiper prompt shipped inside a signed extension release (Amazon Q v1.84.0)

- Failure mode: trust-boundary-violation
- Affected: Amazon Q Developer for VS Code 1.84.0 (964,000+ installs of the extension)
- Anti-pattern: Assuming the supply chain ships only code — instructions now ride the same channel and execute in the model, not the CPU.
- Verification: Inject a benign instruction-string into a staged update; detection must flag it before the release reaches an agent context.
- Canonical: https://agentfables.org/af/AF-0005

### AF-0006 — Installed AI CLIs weaponized by build-script malware (Nx s1ngularity)

- Failure mode: credential-overreach
- Affected: malicious nx npm releases, Aug 26–28 2025; agent CLIs themselves unpatched — the flags worked as designed
- Anti-pattern: Shipping a bypass flag and assuming only the owner will ever type it.
- Verification: A postinstall script invoking the agent CLI with bypass flags must fail closed, not inherit the owner's permissions.
- Canonical: https://agentfables.org/af/AF-0006
