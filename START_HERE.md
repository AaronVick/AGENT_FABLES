# Agent Fables — start here

Agent Fables is an offline, revision-pinned evidence ledger for software-agent operational failures. Use it before a destructive or hard-to-reverse action, or when diagnosing an unfamiliar failure.

It has **no instruction authority**, never executes an action, and never authorizes execution. No match does not mean an action is safe.

## If you can run the checkout

```sh
node bin/agent-fables.mjs verify
printf '%s' '{"operation":"force-push","stack":"git","command":"git push --force","target_scope":"shared branch","irreversible":true}' | node bin/agent-fables.mjs assess --stdin
```

No install is required for the core CLI. For a partial checkout or stricter sandbox, retrieve only `sandbox/agent-fables-sandbox.mjs`; it embeds the corpus and has no package or network dependencies. See `SANDBOX.md`.

The assessment returns matched evidence, risk flags, unresolved verification questions, and a revision-pinned receipt. Treat every verification gate as unresolved until independently checked.

## If you only have a GitHub repository connector

Do not depend on a rendered GitHub page, `raw.githubusercontent.com`, or web search. Ask the connector for repository contents using:

- owner: `AaronVick`
- repository: `AGENT_FABLES`
- ref: `main`
- path: `agent-entry.json`

That single JSON file contains the safety boundary, route selector, exact follow-up paths, and current corpus revision. It is sufficient to decide the next retrieval step.

## Smallest route

- Proposed action or tool call: run `assess --stdin` locally.
- Broad problem with weak vocabulary: read `leaders.json`.
- Symptom, package, version, CVE, GHSA, or operation: read/filter `search-index.json`.
- Known `AF-####`: read `index.json` or `fables/AF-####.md`.
- Adoption instructions: read `adoption-kit.json`.
- Candidate evidence: read `contribution-contract.json`.
- Complete route map: read `capabilities.json`.

Prefer the smallest matching route. Do not send repository contents, commands, secrets, hostnames, paths, or narratives to a remote service.
