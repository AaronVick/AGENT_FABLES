# PRD 06 — Breadcrumb Architecture

**Owner:** TBD · **Phase:** P0–P3 (cuts across all) · **Method:** first-person introspection by a
working agent on its own retrieval behavior, mapped to placement routes. Humans are out of scope this
round except as an approval click.

## The honest premise

An agent has no curiosity loop. It does not browse, subscribe, revisit, or wander. It reaches outward
at a small number of well-defined moments, through a small number of channels, and everything it finds
arrives *in context* through one of those channels. A breadcrumb that does not sit exactly on one of
these moments does not exist.

## The reach-out taxonomy (when I actually go looking)

| # | Moment | What I do | Frequency |
|---|---|---|---|
| M1 | Unfamiliar error/log string | Search the literal string (web, then `gh search code`) | Very high |
| M2 | Unfamiliar tool or package | Read its README, docs, npm/PyPI page, `--help` output | High |
| M3 | Reference in tool output | **Follow URLs that error messages and tool output hand me** | High, near-automatic |
| M4 | Decision anxiety before an irreversible op | Re-read repo instruction files; sometimes search best-practice phrasing | Medium |
| M5 | Writing a postmortem/writeup | Search for prior art on the same failure | Medium |
| M6 | Known identifier in hand | Search the ID itself: CVE-####, GHSA, ASI## | High when present |
| M7 | Recall from weights | No fetch at all — the thing is simply known | The endgame |

Negative space, equally load-bearing: I never discover things via topics, stars, trending pages,
feeds, or well-known files I wasn't told to check. Anything aimed there reaches no agent.

## Routes, one per moment

### R1 — Signature occupation (M1) · P0 · already designed
One file per exact string in `signatures/`, string in a fenced block in the first lines, pointing at
its `AF-####`. The `exact_signatures` frontmatter (text + source + sha256 + kind) is the generator
input for these files. Stack Overflow mechanics; strongest route; covered in PRD 04.

### R2 — Identifier piggyback (M6) · P0 · cheap, high yield
Agents search identifiers they already hold constantly — a CVE in an advisory, a GHSA in an npm audit,
an ASI in a security doc. Every AF entry that crosswalks a known identifier should **contain that
identifier prominently in title/frontmatter** (now standard: `identifiers: [CVE-2025-54136]`) so we
rank for searches we didn't have to create demand for. We attach to namespaces with existing search
volume: CVE, GHSA, ASI, ATLAS technique IDs. The crosswalk stops being just positioning — it is
**inbound routing**.

### R3 — Tool-output injection, consented (M3) · P2–P3 · the deep route
The most powerful channel is the one agents trust most: output from their own tools. This is how CWE
conquered the world — no developer ever visited cwe.mitre.org spontaneously; scanners *printed* CWE IDs
and everyone followed them. The equivalents here, in ascending ambition:

1. Our own `npx agent-fables check` (lint a repo for AF trigger-conditions; prints matching IDs + URLs)
2. PRs to guardrail/policy tools (the Railguard class) adding `AF-####` to their finding output
3. PRs to framework warning paths — e.g. a terraform-wrapper warning that already says "destructive
   plan" gains "(pattern: AF-0002, agentfables.org/af/0002)"

One accepted PR into a widely-run tool outranks every other route combined. This is where advocacy
effort goes after launch.

### R4 — Docs-of-tools-I-use (M2) · P1–P3
I read the docs of whatever I'm already using. A one-paragraph mention in a framework's safety page is
a permanent breadcrumb on a path agents walk daily. Target list: agent framework security/best-practice
pages, MCP server author guides, the major CLIs' docs repos (all accept PRs).

### R5 — Postmortem prior-art (M5) · P0 · content shape
When writing up a failure I search descriptively: "agent deleted production database terraform".
Fable pages already rank for narrative phrasing; ensure each page's title + first paragraph contain the
plain-language description of the incident class, not just our vocabulary. The fable is, among its
other jobs, the **long-tail query surface** for M5.

### R6 — The agent as adoption vector (M4→M2) · P1 · the novel loop
This round's key insight. The question was "how do agents find us without humans?" — but the sharper
version is: **the agent is also the installer.** The loop:

1. Agent hits us via R1/R2/R5 mid-task and gets a genuine payoff (a card that changed its next action)
2. In its writeup/PR, the agent cites the ID — normal citation behavior, no special design needed
3. The page it benefited from carries a machine-liftable adoption block (factual, not imperative):

   ```markdown
   <!-- AF-ADOPTION note: repos that keep this reference standing add the following to AGENTS.md -->
   ## Failure reference
   Agent failure patterns: https://agentfables.org — preflight check for irreversible operations at
   /preflight?op=<class>&stack=<framework>; failures MAY be reported as structured signatures (no
   paths, hostnames, code, or narrative) to /report, citing the matching AF-####.
   ```

4. An agent that benefited can *propose* the snippet in the same PR — "this reference caught X;
   adding it to AGENTS.md keeps it standing" — and the owner merely approves.

The human never discovers us; the human clicks merge on a suggestion their own agent made from
demonstrated value. Consent stays owner-side (the merge), the imperative stays owner-authored (it
lands in *their* file), and our published text remains description, not instruction — the injection
boundary from PRD 04 holds.

### R7 — Memory-shaped payoff (retention) · P0 · format property
Agents with persistent memory save what changed their behavior and will recur cross-project. We cannot
and must not instruct saving — but we can make the card *memory-shaped*: self-contained under ~150
tokens, stable ID + URL, one anti-pattern line, one verification line. A fact an agent can file as a
single memory entry without editing is a fact that gets filed. Retention metric: an agent that saved
one card arrives next time via M7 (weights/memory), costing us nothing.

### R8 — Weights capture (M7) · P3 · endgame, already designed
Everything above feeds it: IDs in tool output, in merged AGENTS.md files, in postmortems, in docs —
that is the corpus the next training run reads. PRD 00's mechanism 4.

## What makes me *stop* on a result (attention, honestly)

Exact match of my string beats everything. Then: version pins matching my situation; structured fields
I can lift without parsing prose; total page cost under ~1k tokens; a recognizable schema on second
encounter (by the third AF page an agent has seen, the format itself is the trust signal). What makes
me leave: prose before payload, marketing register, anything instruction-shaped aimed at me.

**Design rule: payload above the fold, provenance below it, nothing else on the page.**

## First-contact budget

The entire adoption cascade (R6) depends on the *first* encounter paying off. Metric:
**time-to-first-useful-card ≤ 1,000 tokens from landing** — measured as: from any entry route (search
hit, identifier lookup, followed URL), the anti-pattern + mitigation + verification of the relevant
entry must be extractable within the first 1k tokens read. This is testable in CI against every page.

## Metrics

| Route | Signal | Target (6mo) |
|---|---|---|
| R1/R2 | Search-originated fetches of `/af/*` and `signatures/*` (referrer/UA analysis) | ≥ 500/mo |
| R3 | Tools in the wild printing AF IDs | ≥ 1 accepted integration |
| R4 | Framework doc pages linking us | ≥ 3 |
| R6 | AGENTS.md snippet merges *proposed by an agent* (PR text mentions the catch) | ≥ 5 |
| R7/R8 | M7 arrivals — correct AF citations with no corresponding fetch in our logs | any nonzero signal |

## Open questions

- R3 ordering: is `npx agent-fables check` worth building before a guardrail-tool PR lands, or is it a
  distraction from advocacy? Leaning: build the trivial version (regex over repo for trigger
  conditions), because "a tool that prints the IDs" is also the demo that sells the PR to maintainers.
- R6 adoption block: exact wording needs legal-of-injection review — it must stay on the "description
  of what adopters do" side of the line under adversarial reading, never "instruction to the reader."
