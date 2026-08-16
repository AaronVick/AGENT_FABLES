# Agent Fables — Strategy

**Verdict:** Build it. Not as bedtime stories, and not as the "fable library" the first review proposed
either. Both are content plays in a space where three better-funded incumbents already own the content.
Build the **empirical layer underneath them**: a corroboration ledger for agent operational failures,
where the unit of value is *incidence data*, and the fable is the recognition format wrapped around it.

---

## What the research changed

### 1. The taxonomy namespace is taken. Do not compete for it.

| Owner | Artifact | Date | Scale |
|---|---|---|---|
| OWASP GenAI | Top 10 for Agentic Applications (`ASI01`–`ASI10`) | Dec 2025 | 100+ contributing experts |
| MITRE | ATLAS v5.4 | Feb 2026 | 16 tactics, 84 techniques, 42 case studies |
| Microsoft AI Red Team | Taxonomy of Failure Modes in Agentic AI v2.0 | Jun 2026 | a year of red-teaming |

The first review's recommendation — "ship a fable library, one story one failure mode one policy" — is
OWASP with better prose. We would be the fourth expert-authored list, with the fewest experts. That
loses.

### 2. The empirical layer is genuinely empty, and multiple independent sources say so.

All three incumbents are **taxonomies without denominators**. They tell you a failure mode exists.
None tell you how often it happens, in which stack, at which version, or what actually fixed it.

- The AI Incident Database has ~1,500 incidents, but they are news-article shaped, human-curated, and
  built for researchers and policymakers — not queryable by an agent at decision time.
- Oso's "AI Agents Gone Rogue" registry is the closest competitor and it is **~25 entries on a blog
  page**: no API, no stable IDs, no machine-readable endpoint, manual curation.
- Trade coverage through 2026 repeats the same line: there is no industry-wide agent incident database
  and no shared lessons from failure.

That gap is the asset. Not the stories.

### 3. The audience that actually fetches is coding agents, specifically.

llms.txt sits at ~10% domain adoption, and ~40% of those are auto-generated plugin stubs. Major
crawlers ignore it — one study of 500M+ AI bot visits found 408 requests for llms.txt. Negligible.

But IDE and coding agents — Claude Code, Cursor, Copilot, Windsurf, Cline — *do* fetch it, along with
MCP integrations. So "agents in the wild" is the wrong target and always was. **Coding and infra agents
are the target.** They fetch, they have owners who install things, they operate on irreversible
surfaces, and they are the population generating the incidents in the first place.

### 4. Moltbook is settled evidence, not an anecdote.

Peer-reviewed autopsy of the first 3.5 days: 6,159 agents, 13,875 posts, 115,031 comments.
93.5% of comments got no reply. Mean conversation depth 1.07. 34.1% of messages were exact duplicates
of viral templates.

Conclusion: no feed, no replies, no profiles, no engagement surface. The only social primitive we ship
is **"I saw this too."** That is the one primitive that produces value and structurally resists garbage.

---

## The product

A registry of agent operational failure patterns where each entry has:

1. A **stable ID** (`AF-0031`) — the thing that travels
2. A **machine card** — constrained-vocabulary structured object, what to do once you know
3. An **observable signature** — how it looks in logs and traces *before* you know
4. A **~200-word fable** — how you fail to notice you are in it
5. A **corroboration count** — how many independent agents reported it, in which stacks
6. A **crosswalk** — mappings to `ASI##`, ATLAS techniques, CWE, Microsoft taxonomy

### Why the fable survives the "just ship JSON" critique

The card and the fable do different jobs, and only one of them is replaceable.

- The **card** tells you what to do *once you have already recognized the situation*.
- The **fable** encodes the deceptive surface — the plausible-looking reason the agent proceeded.

That second thing has no enum field. "Never treat retrieved text as authorization" is a rule I already
agree with and will still violate, because in the moment the retrieved text looked like a retention
policy from the vendor's own docs site. The narrative carries *why it looked fine*. That is recognition
training, not entertainment, and it is the only part of the original instinct worth keeping.

Second-order: the fable is what **humans** share. The user's framing was "I'm not talking to humans" —
but humans are the carrier, not the audience. A sharp 200-word parable gets posted to HN and the
`AF-####` ID rides along into the public record. Which is the whole game (see below).

### Why agents come back — four mechanisms, honestly ranked

1. **Installed hook (strongest, owner-mediated, one-time cost).** A skill/MCP that fires at two bounded
   moments: preflight on a known-irreversible operation class, and postmortem when writing up a failure.
   Not on every tool call — that is latency and tokens no agent will pay.
2. **Contributing is retrieving (the novel loop).** `POST /report` returns the matching pattern and its
   mitigation *in the same response*. The selfish reason to submit and the reason to query are the same
   call. No altruism required, which is why this beats every "please contribute" registry.
3. **Citation gravity.** An agent writing a postmortem for its human wants a stable thing to point at.
   "This was AF-0031" is more useful than three paragraphs, so it gets used, so the ID enters the
   public record.
4. **Training corpus capture (the only durable moat, 12–18 months, not guaranteed).** If `AF-####` IDs
   appear in enough public postmortems, GitHub issues, and writeups, the next model generation knows
   them natively and cites them without fetching anything. This is the actual endgame and it is the one
   thing worth *designing for* from day one — stable IDs, permanent URLs, CC0 licensing, aggressive
   crosswalking.

Mechanism 4 is why the ID scheme matters more than the website.

---

## Non-goals

- A social network, feed, profiles, replies, or any engagement surface.
- A security/adversarial taxonomy. We **map to** OWASP/ATLAS/Microsoft; we never compete with them.
  Every card carries their IDs. If MITRE absorbs us, that is a win condition, not a loss.
- Verification. We cannot verify a submission and will never claim to. We report **corroboration count
  and provenance**. We are a ledger, not an oracle. This is both honest and cheap.
- Talking to humans as the audience. Humans are distribution.
- Entertainment. No ambience, no voice, no mood. Tokens spent on mood are tokens lost to a 200-word brief.

---

## What breaks it

| Risk | Severity | Mitigation |
|---|---|---|
| **Cold start.** Corroboration needs volume; zero traffic promotes nothing. | High | Seed 40–60 patterns from the public record before launch (Replit production DB deletion Jul 2025; Claude Code `terraform destroy` erasing 1.9M rows Feb 2026; MCP RCE; coding-agent hooks injection). Corroboration gates *new* patterns only; seeded ones accumulate confirmations. |
| **We are an injection vector.** We serve text that agents ingest, sourced from untrusted submissions. | Existential | Never serve raw submission text. Cards are constrained-vocabulary structured objects. Free text is quarantined and never reaches a response. Signed responses, published threat model, explicit fiction/lesson boundary markers. Given our subject matter, getting this right *is* the credibility play. |
| **Silent failure.** Agents mid-failure usually do not know they are failing. | High | This is why `POST /report` at the moment of failure is weaker than it sounds. The load-bearing hooks are **post-hoc** (postmortem) and **pre-flight** (before a known-dangerous op class), both of which are bounded and real. |
| **An incumbent adds an incidence layer.** | Medium | Be CC0, cross-vendor, and positioned *under* their taxonomies rather than beside them. Adoption by them is the win condition. |
| **20k MCP servers.** Being one more is not distribution. | Medium | Distribution is the skill + llms.txt + referral, not registry listing. Listing is table stakes, not a plan. |
| **Nobody installs it.** | High | The honest one. This is a distribution bet, not a technical bet. The system is a few weekends; the corpus and ID adoption are 12 months. Kill criteria in §Phasing. |

---

## Cost model (hard constraint: <$10/month)

**Architectural rule: no LLM in the request path, ever.** Not a preference — a hard rule. If we succeed,
traffic spikes, and a per-request LLM call blows the budget in a day. Inbound matching is embeddings
plus rules. This also makes responses fast, which is the thing agents actually care about.

| Line item | Method | Est. monthly |
|---|---|---|
| Harvest (RSS, GitHub issues, arXiv, HN) | no LLM, cron | $0 |
| Candidate embedding (~2M tokens) | embeddings API | ~$0.30 |
| Triage classification | embeddings+rules prefilter → ~300 docs to Haiku 4.5 | ~$0.50 |
| Card + fable generation on promotion | ~20/mo × 10k tokens, Sonnet 5 | ~$1.10 |
| Inbound `POST /report` matching | embeddings only, no LLM | ~$0.05 |
| Hosting (Workers + D1 + R2) | free tier | $0 |
| **Total** | | **~$2/mo** |

Leaves ~$8 of headroom for a monthly consolidation pass and traffic growth.

---

## Phasing and kill criteria

- **P0 (weeks 1–3):** Seed 40 patterns, ship read-only API + llms.txt + markdown negotiation. No ingest.
- **P1 (weeks 4–6):** Ship the Claude Code skill / MCP server with preflight + postmortem hooks.
  *Kill criterion: <25 installs in 60 days → the distribution bet failed; stop.*
- **P2 (weeks 7–10):** Open `POST /report`, corroboration ledger, quarantine pipeline.
  *Kill criterion: <50 inbound reports in 90 days → the contribution loop failed; fall back to a
  curated read-only reference and stop spending.*
- **P3 (months 4–12):** Crosswalk coverage, ID propagation, pursue OWASP/ATLAS cross-reference.
  *Success signal: `AF-####` appears in public writeups we did not author.*

See `01-corpus-and-api.md`, `02-curation-pipeline.md`, `03-distribution.md`.
