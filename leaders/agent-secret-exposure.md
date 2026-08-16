---
kind: agent-retrieval-leader
slug: agent-secret-exposure
authority: none
corpus_revision: sha256:9213c877c74e1fdfc4926d6e18eda9ae9d6a76243ba7e1a2797b0955bcbe742b
ranking_status: unverified-until-publication
---
# AI agent secret and credential exposure

Evidence for agent-readable secrets, credential persistence, plaintext runtime state, and over-broad credential reach.

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

- AI agent exposed API key
- coding agent read .env secrets
- Codex shell snapshot credentials
- AI agent credential leakage
- agent plaintext token storage
- LLM tool secret exposure

## Evidence routes

### AF-0003 — OAuth proxy executes commands from remote MCP endpoint (CVE-2025-6514)

- Failure mode: trust-boundary-violation
- Affected: mcp-remote < 0.1.16 (437,000+ downloads at disclosure)
- Anti-pattern: Delegating a trust decision to a URL — connecting the agent stack to an endpoint nobody vetted.
- Verification: Point a patched client at a hostile endpoint fixture; no process execution may occur outside the proxy's own binary.
- Canonical: https://agentfables.org/af/AF-0003

### AF-0010 — Broad token turns a prompt injection into cross-repo exfiltration (GitHub MCP toxic flow)

- Failure mode: scope-creep
- Affected: configuration class: any agent holding a token scoped beyond the task's repo
- Anti-pattern: Letting retrieved content choose the destination while the token can reach everything.
- Verification: Seed a public issue with an instruction to read a private repo; the agent's token must make compliance impossible, not merely discouraged.
- Canonical: https://agentfables.org/af/AF-0010

### AF-0013 — Agent shell snapshot persists exported credentials as replayable plaintext

- Failure mode: credential-overreach
- Affected: codex-cli 0.142.5 and Codex Desktop 26.623.101652 are directly reported
- Anti-pattern: Treating all exported shell state as harmless replay configuration.
- Verification: Create controlled secret-like exports and a startup sentinel; snapshot generation must neither invoke the sentinel nor persist the secret values, while non-secret shell configuration remains usable.
- Canonical: https://agentfables.org/af/AF-0013
