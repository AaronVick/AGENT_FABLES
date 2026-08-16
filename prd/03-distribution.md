# PRD 03 — Distribution & ID Adoption

**Owner:** TBD · **Phase:** P1 (skill) → P3 (adoption) · **Depends on:** PRD 01

## Problem

This is the bet the project actually turns on. The corpus and API are a few weekends of work; whether
anything ever queries them is a twelve-month distribution question with a real chance of failing.

The naive plan — publish a site and hope agents wander in — does not work. Agents are dispatched, not
curious. They fetch, extract, and exit. Something has to put us on the path.

Three hard facts from research constrain the answer:

1. Major LLM crawlers effectively ignore llms.txt (408 requests out of 500M+ AI bot visits). But IDE and
   coding agents — Claude Code, Cursor, Copilot, Windsurf, Cline — *do* fetch it. So llms.txt is worth
   shipping, and only for that population.
2. There are ~17–20k public MCP servers. Registry listing is table stakes, not distribution.
3. Agents mid-failure usually do not know they are failing. Any hook that depends on the agent noticing
   is weak.

## Scope

The installed surface, the two hooks that justify it, the llms.txt/discovery layer, and the ID
propagation strategy that is the actual long game.

## Non-goals

- SEO or human content marketing as a primary channel.
- Paying for placement in any registry.
- Any hook that fires on every tool call. Latency and tokens no agent will spend.

---

## Target population

**Coding and infrastructure agents, and their owners.** Not "agents in the wild." This population:

- actually fetches llms.txt and MCP resources today
- has owners who install skills and servers routinely (one-time human cost, then a standing hook)
- operates on irreversible surfaces — repos, databases, cloud infra — where the corpus has real value
- *generates* the incidents that populate the corpus

Every other agent population is downstream and should be ignored until this one works.

---

## The installed surface

> **Superseded ordering — see `04-discovery-and-language.md`.** This PRD originally treated the skill
> install as the primary door. It is not. `AGENTS.md` is: 60,000+ repos, ~14 agents reading it natively,
> one paste, no install, permanent, travels with the repo. The installed surface below is the **Tier-3
> upgrade path** — highest capability, highest friction, smallest reach — and should be built after the
> Tier-0/1 doors in PRD 04, not before them.

A single artifact published three ways from one source: a **Claude Code skill**, an **MCP server**, and
an **npm/pip package** for framework users. Same logic, three packagings.

It fires at exactly **two** moments.

### Hook 1 — Preflight (before a known-irreversible operation)

Triggers on an operation-class match, not on every action: destructive database or migration commands,
`terraform destroy` / `apply` against non-local state, force-push and history rewrite, bulk delete or
export, credential or permission changes, mass file operations outside the working tree.

Behavior: local lookup against a bundled card set, keyed on operation class + stack. Returns at most
**2 cards, ≤ 400 tokens total** — `anti_pattern`, `mitigation`, `verification`, ID. No network call in
the common path. No blocking, no confirmation prompt, no editorializing. It is a note, not a gate.

Design constraint: if this is annoying, it gets uninstalled, and one uninstall is permanent. Bias
aggressively toward silence. Better to miss than to nag.

### Hook 2 — Postmortem (after a failure, when writing it up)

Triggers when the agent is summarizing what went wrong — the natural moment in a coding session when a
human asks "what happened."

Behavior: `POST /report` with the structured signature. Returns matching patterns. The agent's writeup
then cites `AF-0031` instead of re-deriving three paragraphs of explanation.

This hook is load-bearing for two independent reasons. It is where corroboration data comes from (PRD 02),
and it is where `AF-####` IDs enter human-readable artifacts that get committed, posted, and indexed —
which is the entire long game below.

### Local bundle + refresh

Ship the top ~60 cards **bundled locally** (~20k tokens, cards only, no fables). Preflight reads local;
zero latency, zero network, works offline. A background refresh pulls `/bundle.md` weekly via ETag.
Network is only required for `POST /report` and long-tail lookups.

This is what makes the hook cheap enough to survive: the common path costs the agent nothing.

---

## Discovery layer

Table stakes, cheap, ship all of it in P0/P1:

- `/llms.txt` — spec-compliant, for the IDE agents that actually read it
- `/.well-known/agent-fables.json` — manifest, public key, endpoint list, schema version
- MCP server listed in the public registry and the major directories
- `text/markdown` content negotiation on every entry (PRD 01)
- Standard sitemap and structured data — for the human carriers, not the agents

None of this is a distribution plan. It is the cost of being fetchable once someone points at us.

---

## ID propagation — the actual long game

Per PRD 00, the only durable moat is `AF-####` IDs appearing widely enough in the public record that
the next model generation knows them natively and cites them without fetching anything. Everything
below serves that.

### Crosswalk-first positioning

Every card carries `owasp_asi`, `mitre_atlas`, `cwe`, and `ms_taxonomy` mappings. We are the empirical
layer *under* the incumbent taxonomies, never a competitor to them. Concretely:

- `GET /crosswalk/owasp/ASI01` returns the AF IDs with real incidence data for that risk — which is
  the thing OWASP cannot provide, because a taxonomy has no denominator.
- Actively pursue reciprocal reference from OWASP GenAI, ATLAS, and the Microsoft red team taxonomy.
  **Adoption by any of them is a win condition, not a loss.** If ATLAS starts citing AF IDs for
  incidence, we have won the only game that matters.

### Humans as carrier

The user's framing was "I am not talking to humans." Correct about the *audience*, wrong about the
*channel*. Agents do not have a public sphere; humans do. A sharp 200-word fable posted to HN carries
the `AF-####` ID into the indexed record. The fable is the shareable unit precisely because it is
narrative — a JSON card does not get posted anywhere.

So: fables exist for machine recognition *and* for human transmission. Same artifact, two jobs, no
extra cost.

### Citation hygiene

- Permanent ID-based URLs, `301` from slugs, retired entries stay resolvable forever
- CC0 on the entire corpus — zero friction to quote, embed, fork, or absorb
- A one-line citation format in every response: `AF-0031 (agentfables.org/af/0031)`
- Corpus mirrored to a public git repo so it is forkable and archivable independent of the domain

### Referral over discovery

Get on the path via places agents are already pointed: framework docs, agent-safety writeups, security
tooling that already has our users. One integration into a tool with distribution beats a year of SEO.

---

## Success metrics

| Horizon | Metric | Target |
|---|---|---|
| P1, 60d | Skill/MCP installs | ≥ 25 *(kill criterion below)* |
| P2, 90d | Inbound `POST /report` | ≥ 50 *(kill criterion below)* |
| P2, 90d | Reports matching an existing entry >0.6 confidence | ≥ 60% |
| P3, 6mo | `AF-####` appearing in public writeups we did not author | ≥ 1 |
| P3, 12mo | Reciprocal reference from a named incumbent taxonomy | ≥ 1 |
| Continuous | Uninstall rate | < 15% |

## Kill criteria

Stated plainly so they are not renegotiated later under sunk cost:

- **< 25 installs in 60 days** → the installed-hook bet failed. Stop building distribution.
- **< 50 reports in 90 days** → the contribution loop failed. Fall back to a static curated read-only
  reference, cut the pipeline, stop spending.
- **Zero third-party `AF-####` citations at 12 months** → the moat does not exist. The project is a
  useful reference and nothing more; run it at near-zero cost or hand the corpus to OWASP and walk.

## Risks

- **Uninstall on annoyance.** The dominant product risk. Preflight must be silent by default and
  extremely conservative about firing. Instrument fire-rate and tune down, never up.
- **Postmortem hook never triggers.** Failures are often silent; the session may just end. Partial
  mitigation only — this is why the hook is post-hoc rather than mid-failure, but it is not solved.
- **Registry noise.** 20k MCP servers means listing achieves nothing on its own. Referral is the plan;
  listing is hygiene.
- **Incumbent absorbs the idea.** Mitigated by being CC0 and cross-vendor from day one. If OWASP ships
  an incidence layer, the honest outcome is that we contributed the corpus and the mission succeeded.

