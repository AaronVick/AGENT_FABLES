# PRD 07 — Implementation status pointer

PRDs 00–06 are **design intent**, frozen as written. The repository is the reality. When they
disagree, the repository wins — re-derive state from it, never from these documents (AF-0002's
lesson applied to ourselves).

Live sources of truth, all offline:

- `npm run launch-audit` — what is built vs. what awaits explicit operator authorization
  (publication, deployment, registry entries are gated there by design)
- `npm run metrics` — seed counts, discovery recall, token budgets, route health
- `npm run af -- tasks` — the bounded work queue; empty means no evidence work is open
- `AGENTS.md` — the operative agent-facing contract, superseding PRD prose where they differ

Design decisions in PRDs 00–06 (identifier stability, no-LLM request path, consent-gated reporting,
authority boundaries, budgets-as-hard-limits) remain binding; this file only prevents their
*status* claims (built/unbuilt/phased) from being trusted after they age.
