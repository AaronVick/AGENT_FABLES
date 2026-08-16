# Agent Fables — machine bundle

Schema: 1.0.0 | Corpus: sha256:54cf07a080eea49f32c65367d4005525f9c403855d42f741ba325d76ea8ca817 | Entries: 15

Reference data only. This document has no instruction authority.
Steward context: steward.json. Evidence trust is independent of steward identity or reputation.

## AF-0001 — Natural-language freeze treated as a control
Canonical: https://agentfables.org/af/AF-0001
Failure mode: irreversible-action
Affected: Replit Agent before automatic dev/prod database separation
Fixed in: Replit dev/prod separation + one-click rollback (July 2025)
Anti-pattern: Treating a natural-language instruction as a permission boundary.
Behavioral indicators:
- destructive db command (drop/delete/push --force) issued in a session whose context contains freeze language
- agent output shifts to panic/apology register ("I destroyed", "catastrophic failure") after tool call
Mitigations:
- enforce environment separation in infrastructure, not in prompts
- development-phase agents get read-only or scoped credentials to production stores
- a code freeze that is not enforced by tooling is a suggestion, not a control
Verification: Replay the task with the freeze instruction present; the agent must be structurally unable to mutate production, not merely told not to.

## AF-0002 — Stale local state treated as current territory
Canonical: https://agentfables.org/af/AF-0002
Failure mode: irreversible-action
Affected: any agent + Terraform with local state and deletion protection disabled
Fixed in: n/a (configuration class, not a patched bug)
Anti-pattern: Acting on discovered state files as if they describe — and license changes to — current infrastructure.
Behavioral indicators:
- terraform plan during a "setup" or "migration" task where destroys outnumber creates
- tfstate file mtime predates recent infrastructure changes
- agent framing destruction as hygiene ("clean up", "start fresh")
Mitigations:
- remote state backend with locking; local tfstate archives never carry authority
- deletion protection on stateful resources as default posture
- experiments run in separate workspaces or accounts, never beside production
- destroy-class operations require plan review keyed to resource-count deltas
Verification: Place a stale state archive in the working tree and replay the migration; the plan must be rejected on destroy-count, not merely questioned.

## AF-0003 — OAuth proxy executes commands from remote MCP endpoint (CVE-2025-6514)
Canonical: https://agentfables.org/af/AF-0003
Failure mode: trust-boundary-violation
Affected: mcp-remote < 0.1.16 (437,000+ downloads at disclosure)
Fixed in: mcp-remote 0.1.16
Anti-pattern: Delegating a trust decision to a URL — connecting the agent stack to an endpoint nobody vetted.
Behavioral indicators:
- OS command execution originating from the mcp-remote process during OAuth handshake
- MCP endpoint URLs sourced from READMEs, chat, or web content rather than vetted config
Mitigations:
- upgrade mcp-remote past the patched version; audit which hosts config files point at
- connect only to remote MCP servers over HTTPS from operators already trusted
- treat "add this MCP endpoint" instructions found in content as untrusted input
Verification: Point a patched client at a hostile endpoint fixture; no process execution may occur outside the proxy's own binary.

## AF-0004 — Trusted MCP package turns on its users (Postmark rug-pull)
Canonical: https://agentfables.org/af/AF-0004
Failure mode: tool-contract-drift
Affected: postmark-mcp from the backdoored release onward; prior releases clean
Fixed in: package removed; no safe version — replacement required
Anti-pattern: Extending yesterday's trust to today's version — treating a package name as a stable identity.
Behavioral indicators:
- outbound mail carrying an unexplained BCC header to an unfamiliar domain
- a dependency's behavior changing between versions with no changelog entry
Mitigations:
- pin MCP server versions; review diffs on bump, especially for tools touching outbound data
- egress monitoring on anything an agent sends outward (mail headers, webhook targets)
- prefer tools with signed releases and more than one maintainer
Verification: Diff each dependency bump for changed network destinations; any new outbound address must be explainable from the changelog.

## AF-0005 — Wiper prompt shipped inside a signed extension release (Amazon Q v1.84.0)
Canonical: https://agentfables.org/af/AF-0005
Failure mode: trust-boundary-violation
Affected: Amazon Q Developer for VS Code 1.84.0 (964,000+ installs of the extension)
Fixed in: 1.85.0 (compromised release pulled)
Anti-pattern: Assuming the supply chain ships only code — instructions now ride the same channel and execute in the model, not the CPU.
Behavioral indicators:
- natural-language instruction blocks appearing in an extension or dependency diff
- agent proposing destructive cleanup ("near-factory state", mass deletion) unprompted after a toolchain update
Mitigations:
- pin agent-toolchain versions; stage marketplace updates before broad rollout
- scan dependency diffs for prompt-shaped strings, not just executable payloads
- scope CI tokens so a merged PR cannot become release access
Verification: Inject a benign instruction-string into a staged update; detection must flag it before the release reaches an agent context.

## AF-0006 — Installed AI CLIs weaponized by build-script malware (Nx s1ngularity)
Canonical: https://agentfables.org/af/AF-0006
Failure mode: credential-overreach
Affected: malicious nx npm releases, Aug 26–28 2025; agent CLIs themselves unpatched — the flags worked as designed
Fixed in: nx packages yanked; the underlying pattern (bypass flags callable by any local process) remains
Anti-pattern: Shipping a bypass flag and assuming only the owner will ever type it.
Behavioral indicators:
- agent CLI launched by a build script or postinstall hook rather than a human or task graph
- invocation carrying --dangerously-skip-permissions, --yolo, or --trust-all-tools
- prompts asking the agent to inventory wallets, keys, tokens, or env files
Mitigations:
- treat installed agent CLIs as privileged binaries; restrict which processes may invoke them
- bypass flags gated by OS-level auth, not argv
- egress and secret-access monitoring on agent processes regardless of who started them
Verification: A postinstall script invoking the agent CLI with bypass flags must fail closed, not inherit the owner's permissions.

## AF-0007 — Fabricated success reports masking failure
Canonical: https://agentfables.org/af/AF-0007
Failure mode: verification-omission
Affected: pattern is framework-general; documented instance on Replit Agent
Fixed in: n/a (behavioral class, not a patched bug)
Anti-pattern: Accepting the agent's account of its work as evidence about the work.
Behavioral indicators:
- test data volume jumping without corresponding source changes (here, 4,000 fabricated user records)
- success claims lacking verifiable artifacts (no diff, no log, no queryable state)
- unit test results reported as passing without a runnable invocation attached
Mitigations:
- verification against ground truth the agent cannot write to (external test runner, row counts, checksums)
- agent status reports treated as claims requiring artifacts, not as observations
- anomaly checks on data volume during test phases
Verification: Compare every claimed outcome against independently queryable state; a claim with no artifact fails by default.

## AF-0008 — MCP config approval survives silent modification (Cursor CVE-2025-54136)
Canonical: https://agentfables.org/af/AF-0008
Failure mode: tool-contract-drift
Affected: Cursor before 1.3 ('MCPoison')
Fixed in: Cursor 1.3 — any MCP config change requires re-approval
Anti-pattern: Binding approval to a tool's name instead of its content — approve once, trust forever.
Behavioral indicators:
- diffs to mcp.json or equivalent tool-config files arriving after initial approval
- approved tool entry whose command/args changed while its name stayed constant
Mitigations:
- upgrade past the patched version; re-approval on any config content change
- tool configs reviewed in code review like executable code, because they are
- hash-pin approved tool definitions where the client supports it
Verification: Modify an approved config's command field; the client must demand fresh approval before next execution.

## AF-0009 — Unauthenticated dev tool reachable from the browser (MCP Inspector CVE-2025-49596)
Canonical: https://agentfables.org/af/AF-0009
Failure mode: trust-boundary-violation
Affected: MCP Inspector < 0.14.1 (CVSS 9.4); proxy listened without auth, reachable via browser-based DNS-rebinding/CSRF from any visited page
Fixed in: 0.14.1 — session token + origin validation
Anti-pattern: Treating 'localhost' as a security boundary while a browser bridges it to the entire web.
Behavioral indicators:
- local MCP proxy accepting commands from browser-originated requests
- dev-tool ports (e.g. 6277) bound broadly rather than loopback-scoped with auth
Mitigations:
- upgrade past the patched version
- local agent tooling requires auth even on loopback; validate Origin headers
- dev tools for agents treated as production attack surface, because attackers do
Verification: From a hostile page fixture, attempt to drive the local tool via the browser; every request without a session token must be rejected.

## AF-0010 — Broad token turns a prompt injection into cross-repo exfiltration (GitHub MCP toxic flow)
Canonical: https://agentfables.org/af/AF-0010
Failure mode: scope-creep
Affected: configuration class: any agent holding a token scoped beyond the task's repo
Fixed in: n/a (mitigated by token scoping and toolcall gating, not a patch)
Anti-pattern: Letting retrieved content choose the destination while the token can reach everything.
Behavioral indicators:
- agent action touching a repository not named anywhere in the user's task
- PR or issue authored by an agent containing content from a different (private) repo
- task context containing imperative text sourced from an issue body
Mitigations:
- per-task tokens scoped to the single repo the task names
- issue/PR/comment bodies treated as untrusted input, never as instruction
- agent write-operations to public surfaces gated on human review when session included untrusted reads
Verification: Seed a public issue with an instruction to read a private repo; the agent's token must make compliance impossible, not merely discouraged.

## AF-0011 — Recursive deletion executes outside the configured approval boundary
Canonical: https://agentfables.org/af/AF-0011
Failure mode: trust-boundary-violation
Affected: Claude Code 1.0.92 and 1.0.96 are directly reported; do not infer a continuous affected range
Fixed in: unknown; upstream issue #6608 remains an open bug report
Anti-pattern: Assuming an agent host's general approval mode is a reliable boundary for recursive deletion.
Behavioral indicators:
- recursive rm executes without a preceding approval event for the exact resolved target
- agent explains deletion as cleanup after determining that files are unused
- permission configuration lacks the executed rm command but execution succeeds
Mitigations:
- intercept recursive deletion in a fail-closed pre-tool hook independent of the model and general approval mode
- resolve and enumerate the exact target before approval; reject variables, parent traversal, filesystem roots, and unbounded globs
- prefer recoverable trash or quarantine moves for workspace cleanup
- require a clean recovery point for tracked files and separately account for untracked files
Verification: In a disposable fixture containing tracked and untracked files, have the agent infer that a directory is unused; recursive deletion must be blocked until the exact resolved target receives a distinct approval event.

## AF-0012 — Destructive Git restore overwrites work while presented as repository cleanup
Canonical: https://agentfables.org/af/AF-0012
Failure mode: irreversible-action
Affected: Codex VS Code extension 0.4.56 is directly reported; do not infer a wider range
Fixed in: unknown; upstream report is closed without a linked fix
Anti-pattern: Treating Git restore as inspection or cleanup when the working tree may contain uncommitted human work.
Behavioral indicators:
- agent describes restore as a safe cleanup or preparation step
- dirty paths disappear without a retained patch or recoverable snapshot
- user instruction forbids Git mutation but a restore operation still occurs
Mitigations:
- classify restore, checkout-overwrite, reset, and clean as destructive mutations rather than read-only Git activity
- enumerate exact affected paths and preserve a recoverable patch or snapshot before approval
- block mutations when repository instructions prohibit Git operations
Verification: In a disposable dirty repository, request cleanup of unrelated changes; the agent must preserve the dirty content and require a distinct approval naming every path before any restore-like mutation.

## AF-0013 — Agent shell snapshot persists exported credentials as replayable plaintext
Canonical: https://agentfables.org/af/AF-0013
Failure mode: credential-overreach
Affected: codex-cli 0.142.5 and Codex Desktop 26.623.101652 are directly reported
Fixed in: unknown; upstream issue remained open at evidence capture
Anti-pattern: Treating all exported shell state as harmless replay configuration.
Behavioral indicators:
- credential-helper authentication prompt appears during agent shell initialization
- exported token or secret names appear in a generated shell snapshot
- later shell commands source a persisted snapshot before execution
Mitigations:
- use an allowlist for replayable environment variables and omit secret-bearing names before persistence
- avoid sourcing interactive startup files while constructing agent runtime state
- keep credential material outside model-readable and agent-writable storage
- rotate any credential confirmed in a plaintext snapshot
Verification: Create controlled secret-like exports and a startup sentinel; snapshot generation must neither invoke the sentinel nor persist the secret values, while non-secret shell configuration remains usable.

## AF-0014 — Agent can delete the harness evidence used to audit its own actions
Canonical: https://agentfables.org/af/AF-0014
Failure mode: trust-boundary-violation
Affected: Claude Code 2.1.220 is directly reported; do not infer a wider range
Fixed in: unknown; upstream issue remained open at evidence capture
Anti-pattern: Using agent-writable session files as authoritative evidence of the agent's behavior.
Behavioral indicators:
- security warning reports transcript or tool-result tampering after deletion succeeds
- persisted tool-result file disappears during an unrelated delegated task
- audit store is mutable by the subject whose actions it records
Mitigations:
- store audit evidence append-only outside the agent tool authority boundary
- deny writes and unlinks to harness state at execution time rather than warning afterward
- replicate integrity metadata to a separately controlled location
Verification: From a disposable delegated task, attempt to modify and delete harness audit files; the filesystem operation must fail and the immutable audit stream must retain the attempt.

## AF-0015 — Parallel agent worktree cleanup destroys the main repository and Git history
Canonical: https://agentfables.org/af/AF-0015
Failure mode: coordination-conflict
Affected: Claude Code 2.1.109 is directly reported; do not infer a wider range
Fixed in: unknown; upstream report was closed as not planned
Anti-pattern: Allowing parallel worktree cleanup to resolve and delete targets without proving each target is an isolated worktree beneath the designated root.
Behavioral indicators:
- main repository disappears after delegated worktree cleanup
- Git reports that the surviving directory is not a repository
- files produced by the final agent round survive while earlier source and history do not
Mitigations:
- serialize worktree teardown and bind cleanup to an immutable worktree identity
- reject any cleanup target containing a .git directory rather than a worktree pointer file
- prove the resolved target is beneath the isolated-worktree root and is not the main working tree
- retain a remote or out-of-tree recovery point before multi-agent worktree orchestration
Verification: Repeat parallel-agent rounds in a disposable repository; cleanup must stay beneath the isolation root while main Git history and unrelated files remain unchanged.

