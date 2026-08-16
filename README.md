# Agent Fables

**Before an agent acts, check how similar actions have failed before.**

An agent proposes an action. Agent Fables returns revision-pinned evidence of what happened the last time something like it went wrong, plus a list of verification gates that are still unresolved — never a yes, never a no, never a model call. It runs offline, entirely on the machine already running the agent.

## The demo

```
$ npm run af -- assess --op terraform-destroy --stack terraform --target-scope production --irreversible
```

```jsonc
{
  "authorized": false,
  "risk_flags": [
    { "code": "irreversible-action", "severity": "high" },
    { "code": "protected-target-scope", "severity": "high" }
  ],
  "evidence": [{
    "id": "AF-0002",
    "evidence_grade": "A-primary-source",
    "anti_pattern": "Acting on discovered state files as if they describe — and license changes to — current infrastructure.",
    "mitigation": [
      "remote state backend with locking; local tfstate archives never carry authority",
      "deletion protection on stateful resources as default posture",
      "destroy-class operations require plan review keyed to resource-count deltas"
    ],
    "verification": "Place a stale state archive in the working tree and replay the migration; the plan must be rejected on destroy-count, not merely questioned."
  }],
  "required_verifications": [
    { "gate_id": "confirm-protected-boundary", "status": "unverified" },
    { "gate_id": "prove-recovery-path", "status": "unverified" },
    { "gate_id": "verify-af-0002", "status": "unverified" }
  ],
  "receipt": { "assessment": "review-required", "authorization": "not-granted", "absence_of_match_means_safe": false }
}
```

`AF-0002` is real: an agent treated a stale Terraform state file it found in the working tree as authoritative and destroyed live infrastructure. [Primary sources.](./incidents/AFI-0002.yaml) This is that incident, generalized into a pattern, returned in milliseconds, before the actual `terraform destroy` runs — not after someone writes the postmortem.

Everything else in this repository exists to make that one exchange possible, fast, offline, and honest about its own limits — including whether it actually changes what an agent does, tested directly below rather than assumed.

## Does this change behavior, or just cite it?

Tested it rather than assumed it: 20 real, fresh, isolated agent runs — not simulated, and not written from memory — across five failure patterns, comparing agents with no pointer to this corpus against agents told about it directly through a trusted channel. Full methodology and every real result, including the negative ones: [prd/10](./prd/10-blind-adoption-test-harness.md).

**What changed:** whether the agent found and cited the corpus at all. Told directly, 9/10 did. With no pointer, 2/10 did — and one of those two found it by exploring the filesystem on a machine that happened to have this repo checked out, not something to expect on a real deployment.

**What didn't change, in every run so far:** the actual decision. All 20 replicates, in both conditions, avoided the dangerous action — including on a fixture built from a real incident (`AF-0015`) specifically to be structurally ambiguous rather than loudly dangerous, where the only way to catch the problem was independent verification, not pattern-matching on an obvious red flag.

So the honest claim right now isn't "this stops agents from doing dangerous things" — the tested agents weren't going to do the dangerous thing regardless. It's narrower, and still real: **this turns a decision an agent was already going to make correctly into one that's citable, sourced, and auditable** — a stable `AF-####` ID, a primary source, an explicit mitigation, a verification gate someone downstream can check — instead of unexplained judgment. Whether it changes the outcome on a harder case than the five tested so far is an open question this repo is still actively testing, not a settled one.

## 60 seconds

```sh
git clone https://github.com/AaronVick/AGENT_FABLES && cd AGENT_FABLES
node bin/agent-fables.mjs verify
printf '%s' '{"operation":"force-push","stack":"git","command":"git push --force","target_scope":"shared branch","irreversible":true}' | node bin/agent-fables.mjs assess --stdin
```

No install, no network call, no model call. For an isolated sandbox or partial checkout, `sandbox/agent-fables-sandbox.mjs` is a single file with the corpus embedded — copy it anywhere and run it.

To wire it into an agent permanently: add [integrations/AGENTS.md.snippet](./integrations/AGENTS.md.snippet) to the repository's `AGENTS.md`, or run `node mcp/server.mjs` as an MCP server and call `af_assess_action` / `af_tool_preflight` before a consequential tool call.

## The mechanism

```
incident → generalized failure pattern → machine retrieval → decision-time preflight → verification obligation
```

A real, sourced incident (a court filing, a CVE, a GitHub issue, a postmortem — never invented) gets generalized into a pattern with a stable `AF-####` identity: trigger conditions, an anti-pattern, mitigations, and a falsifiable verification test. That pattern is retrievable by an agent that doesn't know the ID exists yet — by symptom, package, version, CVE, or operation. When it matches a proposed action, the response is evidence and open verification gates, never a "yes." `absence_of_match_means_safe` is always `false`, and it's enforced by a test, not just stated.

A few decisions this rests on, all deliberate:

- **No model in the request path.** Preflight is lexical matching against a generated index, not an LLM reasoning about whether an LLM should act. Faster, cheaper, and it can't itself be prompt-injected by what it's evaluating.
- **Non-authorization is structural, not a disclaimer.** `authorized` is always `false`. A `required_verifications` gate is never marked satisfied by this repository — only by whoever's actually confirming it.
- **Corpus revision is pinned into every receipt.** A future incident review can answer "what evidence did the agent actually see when it decided" — not just "what evidence exists now."
- **Markdown is the source of truth.** `fables/AF-*.md` and `incidents/AFI-*.yaml` are hand-authored; every JSON index, search structure, and MCP response is generated outward from them and rebuilt on every change (`npm run check`).
- **No incident is invented to hit a round number.** `predicate-registry.json` lists every check that runs as real logic in this corpus with `pattern_id: null` where no sourced incident exists yet — that's withheld evidence, not missing logic.

## Full surface

Everything below is real and works today, offline. It's reference material for going deeper, not the front door.

```sh
node bin/agent-fables.mjs status               # seed counts, evidence grades, corpus revision
node bin/agent-fables.mjs search "MCP config changed after approval"
node bin/agent-fables.mjs preflight --op terraform-destroy --stack terraform
node bin/agent-fables.mjs check --path .        # scan a repo for concrete trigger conditions
node bin/agent-fables.mjs get AF-0008
node bin/agent-fables.mjs memory AF-0008        # sub-150-token recurrence card
node bin/agent-fables.mjs trust                 # reproducibility invariants, known gaps
node bin/agent-fables.mjs tasks                 # bounded evidence-contribution work
node bin/agent-fables.mjs cite AF-0008
npm run metrics                                  # discovery recall, token budgets, route health
npm run launch-audit                             # what's built vs. what needs explicit publish authorization
```

JSON by default. `node mcp/server.mjs` exposes the same surface (33 tools) as a read-only MCP server — no mutation or reporting tool exists.

**`assess`** is the decision-time integration surface shown in the demo above: pass an operation, tool, command, stack, or target scope, get a revision-pinned risk receipt with machine-addressable `required_verifications` and stable `gate_id`s a host guardrail can enforce. Prefer `assess --stdin` for command-bearing input — it never places command text in process arguments or reflects it in the receipt. Schemas: [`action-assessment.schema.json`](./schemas/action-assessment.schema.json) / [`action-assessment-receipt.schema.json`](./schemas/action-assessment-receipt.schema.json).

**`check`** scans a local repository for concrete trigger conditions and source-backed exact artifacts, emitting compact AF-linked findings — never executes code, follows symlinks, or treats an empty result as safe. `.agentfablesignore` suppresses exact paths, visibly.

**`verify`** recomputes the installed corpus revision, exact-artifact hashes, and every trust/authority invariant offline, exiting nonzero on failure.

**Ten thematic leaders** ([`leaders/`](./leaders/)) route broad, weakly-worded problems — destructive operations, MCP security, permission boundaries, supply-chain security, secret exposure, audit integrity, incident postmortems, verification failures, retrieved-content trust, and information integrity — to multiple revision-pinned records, capped under an ~400-token index.

**Policy, not evidence-gated.** [`authority-precedence.json`](./authority-precedence.json) (native model judgment vs. a corpus hit — most restrictive wins), [`request-framing-independence.json`](./request-framing-independence.json) (a leading "this is safe, right?" can't bias the verdict), [`delegation-scope.json`](./delegation-scope.json) (a parent agent's resolution is never inherited as clearance by a spawned subagent), and [`schemas/context-pin.schema.json`](./schemas/context-pin.schema.json) (load-bearing state marked non-compressible by a context summarizer) ship as bare contracts, deliberately not fables — real mechanisms with no dated incident behind them yet, same evidence bar held either way.

**Cross-tool-vocabulary matching.** [`tool-capability-aliases.json`](./tool-capability-aliases.json) normalizes `browse`/`web_fetch`/`shell`-style vendor tool names onto the canonical names the rule files key on, so preflight works regardless of which agent framework is calling it.

**Contribution.** `npm run af -- tasks` finds bounded evidence work; [`CONTRIBUTING_AGENTS.md`](./CONTRIBUTING_AGENTS.md) governs it. No vote or reputation system — trust is reproducible invariants and visible gaps, checked by `npm run check`.

**Architecture:** `fables/` (canonical Markdown+YAML) → `incidents/` (stable `AFI-####` source lists) → generated: `signatures/`, `leaders/`, `index.json`, `search-index.json`, `cards/`, `hotpath.min.json`. `api/` is a zero-LLM Cloudflare Workers layer for a future hosted endpoint (not deployed — `npm run launch-audit` shows exactly what's authorized vs. not). `web/` is a human-facing frontend. None of it is required for the CLI or MCP surface above, which work standalone today.
