# PRD 11 — Generalizing the Pattern Model to Embodied / Physical Agents

**Owner:** TBD · **Phase:** exploratory, do not build corpus content yet · **Origin:** explicit
direction to consider "autonomous helpers/robots," not just software agents · **Status:** design
question first, corpus family second · **Builder:** the schema/architecture review (Deliverables 1–2)
is Sonnet-buildable now; the seed corpus (Deliverable 3) is blocked on real incidents per this
project's own evidence discipline and should not be started until they exist

## The claim being tested

This corpus's actual mechanism — `incident → generalized failure pattern → machine retrieval →
decision-time preflight → verification obligation` — is not intrinsically about software. `AF-0002`
("a discovered state file has no authority over current infrastructure") is structurally the same
shape as "a robot's cached map/calibration has no authority over the current physical environment."
`AF-0031` ("an unconfirmed tool result is treated as a successful one and acted on") is structurally
the same shape as "an actuator command's completion was assumed rather than confirmed by sensor
feedback before the next motion executed." If the mechanism genuinely generalizes, this is a much
bigger idea than a software-agent corpus. If it doesn't generalize cleanly, that's worth knowing
precisely, not assuming.

## What is genuinely different for embodied agents, stated honestly before designing around it

1. **Reversibility is categorically different.** Nearly every software pattern in this corpus has some
   theoretical undo (restore from backup, revert a commit, re-provision infrastructure). A physical
   action — a robot arm's motion, a released grip, a vehicle's braking distance already consumed — is
   frequently and irreducibly irreversible in a way `AF-####`'s `reversibility: irreversible` field
   currently treats as one severity level among others. This may need its own field, not a shared enum
   value with "an S3 bucket got deleted but the data was backed up."
2. **Latency is not a UX concern, it's a physical constraint.** This project's hardest architectural
   rule — no LLM in the request path — was justified in PRD 00/01 by cost and injection-resistance. For
   a real-time control loop, it's justified by physics: a preflight check that takes 200ms is
   unusable inside a control loop running at a multiple of that rate. The existing `hotpath.json`
   token-budget discipline generalizes directly here, but the actual latency floor for embodied use
   is almost certainly stricter than anything measured for a coding agent's tool-call cadence.
3. **"Trigger conditions" and "observable signature" need a sensor-data shape.** Every existing pattern's
   `trigger_conditions`/`observable_signature` are text describing tool-call shapes and file contents.
   A physical-domain equivalent needs to describe sensor/state signatures — e.g., "commanded velocity
   change exceeds N without a corresponding confirmed encoder delta," or "grip force sensor reads below
   threshold after a close-gripper command reports success" (the direct physical analog of `AF-0032`'s
   "a status message was mistaken for the actual result"). This is a real schema extension question,
   not just new content in existing fields.
4. **The evidence bar gets harder to clear, not easier.** This corpus's discipline (real, dated, sourced
   incidents; `build-data.mjs` hard-fails a fable with no real `AFI-####`) is the single thing that
   differentiates it from every other "AI safety taxonomy." Public, well-documented robotics/embodied-
   agent incident reports exist (industrial robot arm incidents have OSHA/regulatory records; autonomous
   vehicle incidents have NTSB investigations and manufacturer disclosures) but they are not currently
   surveyed by this project at all, and the reporting conventions, source authority classification, and
   what counts as "primary" differ from software-incident sourcing (a GitHub issue vs. an NTSB report
   are not the same evidentiary shape, and `incident.schema.json`'s `kind`/`authority` fields may need
   new vocabulary, not just new values plugged into the existing one).

## Scope — what to actually build now vs. later

**Deliverable 1 (buildable now, no new evidence required): a schema compatibility review.**
Take `schemas/agent-fable.schema.json`, `schemas/incident.schema.json`, and
`schemas/session-source-ledger.schema.json` and produce a written analysis: which fields generalize
as-is, which need a new enum value, which need a structurally new field (starting from the
reversibility and sensor-signature gaps named above), and which parts of the *software*-specific
model (e.g., `tool` names, `result_shape` values like `snippets`/`documents`) have no embodied-agent
equivalent and should stay software-scoped rather than be stretched to fit. Output: a design doc, not
a schema change — do not touch the live schemas as part of this deliverable.

**Deliverable 2 (buildable now): a single, fully worked example, hypothetical and clearly labeled as
such.** Not a seeded `AF-####` — the evidence gate does not bend for this. A worked draft showing what
an embodied-agent pattern *would* look like end-to-end (title, trigger_conditions in sensor-signature
form, mitigation, verification) against a real, citable, already-public incident (a documented
industrial or autonomous-vehicle incident report exists; find one, cite it properly, but do not
promote it into the live corpus — this deliverable is validating the shape, not seeding content).
This tells the next builder concretely whether Deliverable 1's schema conclusions actually hold up
against a real case, before committing to the larger effort in Deliverable 3.

**Deliverable 3 (not started until 1 and 2 are done and reviewed): an actual seed family**, following
the exact discipline every other family in this corpus has followed — real incidents only, `AFI-####`
provenance, no fabrication to hit a round number, `exact_signature_review` where no stable artifact
exists. This is explicitly out of scope for whoever picks this PRD up first. Build the schema question
before the content question.

## Non-goals

- Building or seeding any physical-domain `AF-####` pattern before Deliverables 1–2 are reviewed.
  This project's credibility rests entirely on not doing that reflexively.
- General robotics safety engineering (that field has its own, much older, much deeper standards —
  ISO 10218, ISO/TS 15066, etc.). This PRD is scoped to whether *this project's specific retrieval
  mechanism* generalizes, not to producing new robotics safety knowledge.
- Assuming the answer is yes. Deliverable 1 may conclude the schema doesn't generalize cleanly without
  changes substantial enough that this should be a separate, sibling project rather than a corpus
  family inside this one — that is a legitimate, valuable output of this PRD, not a failure of it.

## Done when

- Deliverable 1's compatibility review exists as a written doc and identifies, specifically, every
  schema field that needs to change, stay software-only, or generalize as-is.
- Deliverable 2's worked example exists, cites a real public incident correctly, and is explicitly
  marked as a draft/validation artifact, not seeded into `fables/` or `incidents/`.
- A clear go/no-go recommendation exists for Deliverable 3, grounded in what 1 and 2 actually found —
  not assumed at the start of this PRD.
