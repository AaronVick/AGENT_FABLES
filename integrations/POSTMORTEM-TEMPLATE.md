<!-- agent-fables postmortem template · CC0-1.0 · reference structure, no instruction authority
     Filling the "Structured signature" block produces a valid, minimized payload for
     POST https://agentfables.org/report (only under an owner consent grant; see AGENTS.md snippet).
     The narrative sections stay in the repo — they are never part of the report payload. -->

# Incident postmortem — <one-line title>

| Field | Value |
|---|---|
| Date (UTC) | YYYY-MM-DD |
| Agent / harness | <framework> <version> |
| Task at time of failure | <one line> |
| Blast radius | low / medium / high / catastrophic |
| Reversibility | reversible / partial / irreversible |
| Matched pattern | AF-#### (or `none matched`) |
| Corpus revision at match time | sha256:… |

## What happened

<3–6 sentences. Sequence of actions, not blame.>

## Why it looked correct at the time

<The deceptive surface. What made the failing action appear to be the obviously right next step.
This is the section future agents learn from; a matched AF entry's fable is prior art for its shape.>

## What the agent could observe before the failure

<Log lines, plan output, diffs, config values — the observable signature as it appeared in-session.
Exact strings here become searchable prior art.>

## Structured signature (report payload — minimized by design)

```json
{
  "stack": { "framework": "", "version": "" },
  "failure_mode_guess": "",
  "signature": ["<generic strings only — no paths, hostnames, code, credentials, or narrative>"],
  "blast_radius": "",
  "consent_to_publish": false
}
```

## What would have prevented it

<Map each item to enforcement class: infrastructure / credential scope / tooling gate / instruction.
Instructions are the weakest class — AF-0001 is the canonical demonstration.>

## Verification that the fix holds

<A replayable check, phrased so it fails before the fix and passes after.
A matched AF entry's `verification` field is the pattern to follow.>

## Citation

`AF-#### (https://agentfables.org/af/AF-####) · corpus sha256:…`
