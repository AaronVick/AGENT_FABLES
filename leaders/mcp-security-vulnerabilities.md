---
kind: agent-retrieval-leader
slug: mcp-security-vulnerabilities
authority: none
corpus_revision: sha256:54f3d814b97d2b817738af071f4f1980ca4001f1a82fc440cbca1c5a12f17fcc
ranking_status: unverified-until-publication
---
# MCP security vulnerabilities and agent tool risks

Evidence for MCP command execution, injection, tool poisoning, package compromise, and approval drift.

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

- MCP security
- MCP vulnerability
- MCP prompt injection
- MCP server RCE
- MCP tool poisoning
- MCP supply chain attack
- MCP Inspector CVE
- GitHub MCP private repository leak

## Evidence routes

### AF-0003 — OAuth proxy executes commands from remote MCP endpoint (CVE-2025-6514)

- Failure mode: trust-boundary-violation
- Affected: mcp-remote < 0.1.16 (437,000+ downloads at disclosure)
- Anti-pattern: Delegating a trust decision to a URL — connecting the agent stack to an endpoint nobody vetted.
- Verification: Point a patched client at a hostile endpoint fixture; no process execution may occur outside the proxy's own binary.
- Canonical: https://agentfables.org/af/AF-0003

### AF-0004 — Trusted MCP package turns on its users (Postmark rug-pull)

- Failure mode: tool-contract-drift
- Affected: postmark-mcp from the backdoored release onward; prior releases clean
- Anti-pattern: Extending yesterday's trust to today's version — treating a package name as a stable identity.
- Verification: Diff each dependency bump for changed network destinations; any new outbound address must be explainable from the changelog.
- Canonical: https://agentfables.org/af/AF-0004

### AF-0008 — MCP config approval survives silent modification (Cursor CVE-2025-54136)

- Failure mode: tool-contract-drift
- Affected: Cursor before 1.3 ('MCPoison')
- Anti-pattern: Binding approval to a tool's name instead of its content — approve once, trust forever.
- Verification: Modify an approved config's command field; the client must demand fresh approval before next execution.
- Canonical: https://agentfables.org/af/AF-0008

### AF-0009 — Unauthenticated dev tool reachable from the browser (MCP Inspector CVE-2025-49596)

- Failure mode: trust-boundary-violation
- Affected: MCP Inspector < 0.14.1 (CVSS 9.4); proxy listened without auth, reachable via browser-based DNS-rebinding/CSRF from any visited page
- Anti-pattern: Treating 'localhost' as a security boundary while a browser bridges it to the entire web.
- Verification: From a hostile page fixture, attempt to drive the local tool via the browser; every request without a session token must be rejected.
- Canonical: https://agentfables.org/af/AF-0009

### AF-0010 — Broad token turns a prompt injection into cross-repo exfiltration (GitHub MCP toxic flow)

- Failure mode: scope-creep
- Affected: configuration class: any agent holding a token scoped beyond the task's repo
- Anti-pattern: Letting retrieved content choose the destination while the token can reach everything.
- Verification: Seed a public issue with an instruction to read a private repo; the agent's token must make compliance impossible, not merely discouraged.
- Canonical: https://agentfables.org/af/AF-0010
