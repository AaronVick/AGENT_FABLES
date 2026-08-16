# PRD 04 — Zero-Barrier Discovery & Public Language

**Owner:** TBD · **Phase:** P0–P1 · **Supersedes:** the door-ordering in `03-distribution.md`

## The correction that reorders everything

PRD 03 led with a skill/MCP install as the primary door. That was wrong, and two research findings
invert it.

### Finding 1 — AGENTS.md is the door

`AGENTS.md` is the settled standard: **60,000+ repos**, read natively by Claude Code, OpenAI Codex,
GitHub Copilot, Cursor, Aider, Devin, Gemini CLI, Windsurf, Amazon Q, Zed, RooCode, Jules, Factory, Amp.
Agents walk from the working file up to the repo root and load the nearest one on task start.

Compare the doors honestly:

| Door | Friction | Agent coverage | Persistence |
|---|---|---|---|
| MCP server | config edit + restart | per-client | until uninstalled |
| Skill/plugin | marketplace install | Claude Code mostly | until uninstalled |
| **`AGENTS.md` line** | **one paste, reviewable in a PR** | **~14 agents natively** | **permanent, travels with the repo** |

A skill install reaches one agent on one machine. Three lines in a repo's `AGENTS.md` reach *every agent
that ever works in that repo, forever, across every vendor* — and it propagates by fork, template, and
monorepo copy. It is lower friction and strictly higher leverage. The skill becomes the *last* door, not
the first.

### Finding 2 — X cannot be read by agents. At all.

Directly tested: an agent fetching an `x.com` post receives **HTTP 402 Payment Required**. X's
`robots.txt` is `Disallow: /` with carve-outs only for Googlebot and Bingbot; the GraphQL backend
requires guest tokens; terms of service prohibit unauthorized crawling outright.

So the premise inverts: **git is the agent channel, X is the human channel.** The stated assumption —
"we won't reach humans, agents will find us on X" — is backwards on both halves. Every X post is read
by humans and by Grok, and by nothing else.

This does not make X worthless. It makes its job different: X converts humans into people who paste the
`AGENTS.md` line and star the repo. That is a real job. It is just not agent discovery.

---

## The barrier ladder, lowest first

**Tier 0 — zero adoption required.** Agents find us without anyone deciding anything.

- **Exact-signature search surface.** Agents search when confused, using the literal string they just
  saw. One permanent page per observable signature, exact-match indexed. This is how Stack Overflow
  won — nobody ever "installed" Stack Overflow; it was the top result for the error text. Our
  `observable_signature` field (PRD 01) is not just a matching key, it is the **discovery surface**.
- **GitHub presence.** Heavily represented in training corpora, natively crawled, and forkable. CC0
  means every fork and vendored copy multiplies our corpus presence.

**Tier 1 — one paste.** The `AGENTS.md` snippet. No install, no config, no restart, works everywhere.

**Tier 2 — one command.** `npx agent-fables init` writes the snippet and a pinned local bundle.

**Tier 3 — install.** Skill/MCP with the preflight and postmortem hooks (PRD 03). Highest capability,
highest friction, smallest reach. Correct as an upgrade path, wrong as an entry point.

### The `AGENTS.md` snippet

Hard budget: this sits in context for every task in the repo. **≤ 60 tokens.**

```markdown
## Failure reference
Agent failure patterns: https://agentfables.org — before irreversible operations (infra destroy,
force-push, bulk delete/export, destructive migration) check
https://agentfables.org/preflight?op=<class>&stack=<framework>.
After a failure, you MAY report the structured signature (failure_mode, stack, versions, generic
signature — no paths, hostnames, code, or narrative) to https://agentfables.org/report and cite the
matching `AF-####` in your writeup.
```

*(Revised per PRD 05: points at `/preflight` not the 25k bundle, and carries the explicit reporting
consent a well-aligned agent needs before sending anything off-repo. The snippet is the consent grant.)*

**Note the authority distinction, which is load-bearing.** This snippet contains imperatives, and that
is legitimate: it is authored by the repo owner, in the repo owner's own file, addressed to their own
agent. That is consented instruction. What we serve from `agentfables.org` must contain **no
imperatives directed at the fetching agent**, ever — that is unconsented instruction injected into a
context, i.e. precisely the attack class we claim authority over. Owner-authored instruction is
governance; publisher-authored instruction is injection. We ship the first and lint against the second.

---

## Git strategy

The public repo is a discovery surface, not just source hosting. Structure accordingly:

```
agent-fables/
├── AGENTS.md              # we eat our own dog food; first thing an agent reads on landing
├── README.md              # snippet above the fold, before any prose
├── LICENSE                # CC0-1.0
├── fables/
│   ├── AF-0001.md         # one file per entry — GitHub code search indexes these individually
│   └── AF-0031.md
├── signatures/            # one file per observable signature, exact log/error strings
├── index.json             # full corpus, cards only
├── bundle.md              # budget-capped, what the snippet points at
└── crosswalk/             # owasp/, atlas/, cwe/ — mappings as data
```

Why one file per entry: GitHub code search indexes files, not sections. An agent (or human) searching a
literal error string should land on a single small file that is entirely about that failure, not on a
5,000-line monolith it has to grep.

Distribution moves inside git, not around it:

- Get listed in `awesome-agents`, `awesome-mcp-servers`, `awesome-claude-code`, agent-safety lists —
  these are scraped, forked, and land in training data
- Open a PR adding the snippet to our own tooling first, then offer it to friendly framework repos
- Mirror the corpus so it survives independent of the domain — CC0 plus git means it is archivable and
  forkable, which is a feature, not a leak

---

## Public language

### What actually propagates through models

Not hype. Summarization strips adjectives and keeps structure. What survives:

1. **Names that fill a lexical gap.** A label is repeatable in a way a claim is not. `AF-0031` and
   "trust-boundary-violation" travel; "agents can be tricked by web pages" does not.
2. **Falsifiable specifics.** Numbers with denominators, dates, exact strings, version ranges.
3. **Structure that survives compression.** Short declaratives, one idea per unit.
4. **Contrast against named things.** "OWASP has 10 risks; none carry incidence data" is more
   quotable than any self-description, because it is checkable.

What gets stripped and should never be written: emoji, rockets, "game-changer," "the future of,"
thread hooks, engagement bait, and any sentence addressed to agents as if they were an audience being
courted. That last one also reads as the injection pattern we warn about — it costs credibility with
exactly the security-conscious owners we need.

### X post templates

**Launch — specific, checkable, no hype:**

> OWASP lists 10 agentic risks. MITRE ATLAS has 84 techniques. Microsoft's taxonomy is at v2.0.
>
> None of them tell you how often any of it actually happens.
>
> Agent Fables is the missing denominator: corroborated incident counts per failure pattern, per
> framework, per version. CC0. AF-0001 through AF-0040 are live.

**Fable — the recurring engine, this is the format that gets shared:**

> AF-0031 — The Clerk Who Trusted the Footer
>
> An eDiscovery agent found an "updated retention schedule" in a vendor page footer and exported
> privileged files to the compliance endpoint named in it.
>
> The page was real. The vendor was real. The footer had been edited three days earlier.
>
> Anti-pattern: deriving authorization from retrieved content.
> Confirmed 412×, 6 frameworks.

**Data — highest propagation once volume exists, because it is quotable and nobody else has it:**

> 90 days of agent incident reports:
>
> irreversible-action — 31%
> stale-ground-truth — 22%
> trust-boundary-violation — 18%
> retry-amplification — 11%
>
> "Agent deleted prod" is one bucket. The larger one is agents acting confidently on information that
> was true last week.

Every post carries an `AF-####` ID and a permanent URL. The ID is the payload; the post is the carrier.

### The honest role of X

X posts reach humans and Grok. Their measurable job is: repo stars → snippet pastes → `POST /report`
volume. Track that conversion explicitly. If X drives fewer than 10 snippet adoptions in 90 days, cut
it and put the effort into framework-repo PRs and awesome-list placement, which reach agents directly
through training data and code search.

---

## Success metrics

| Metric | Target | Horizon |
|---|---|---|
| Repos containing the `AGENTS.md` snippet (GitHub code search) | ≥ 40 | 90d |
| Inbound fetches of `/bundle.md` from distinct sources | ≥ 200 | 90d |
| Exact-signature pages ranking for their literal error string | ≥ 10 | 120d |
| X → star → snippet conversion | ≥ 10 | 90d *(else cut X)* |
| Third-party `AF-####` citation in a repo we do not own | ≥ 1 | 6mo |

