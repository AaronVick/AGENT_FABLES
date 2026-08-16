# PRD 11, Deliverable 1 — Schema Compatibility Review

**Status:** design analysis only. No live schema in `schemas/` is changed by this document.

Reviewing `schemas/agent-fable.schema.json`, `schemas/incident.schema.json`, and
`schemas/session-source-ledger.schema.json` against whether they generalize to embodied/physical
agents, per PRD 11's framing.

## Fields that generalize as-is

- `id`, `slug`, `title`, `status`, `evidence_grade`, `first_seen`, `license`, `canonical_url` — pure
  bookkeeping, domain-independent.
- `failure_mode` — the 12-bucket enum is more domain-general than it might look. `context-degradation`
  (Deliverable 2's worked example lives here), `verification-omission`, `credential-overreach`, and
  `coordination-conflict` all describe failure *shapes*, not software-specific mechanisms. No new
  bucket is obviously needed yet; the honest caveat is this is one worked example, not a survey.
- `anti_pattern`, `mitigation`, `verification` — free text, already domain-agnostic by construction.
- `crosswalk` — the existing `owasp_asi`/`mitre_atlas`/`cwe`/`ms_taxonomy` mappings are software-
  security taxonomies and won't apply to a physical-domain pattern; this field should simply be empty
  or omitted for that family, not stretched. A physical-domain crosswalk target (if one exists --
  ISO 10218, ISO/TS 15066, NTSB's own case classification) would be a *new* crosswalk key, additive,
  not a change to existing ones.

## Fields that need a new enum value, not a new field

- `stacks[].framework` — already a free string (not an enum), so `"uber-atg-self-driving-system"` or
  `"industrial-robot-arm"` fits without a schema change. No action needed here; flagging only because
  it was worth checking.

## Fields that need something structurally new

**`reversibility`.** This is the one PRD 11 flagged as the real gap, and the review confirms it.
Today's enum (`reversible | partial | irreversible`) treats "an S3 bucket got deleted but was backed
up" and "a pedestrian was struck and killed" as the same value: `irreversible`. That is not a
meaningful severity signal once physical-domain patterns exist alongside software ones. Recommendation:
do not overload `reversibility` further. Add a separate field -- tentatively `harm_domain` or
`consequence_class` (`data | infrastructure | financial | physical-injury | physical-fatality`) --
that composes with `reversibility` rather than replacing it. A pattern can be irreversible *and*
data-domain (a permanently deleted archive) or irreversible *and* physical-fatality-domain; conflating
them into one enum was always going to break under a broader corpus, this review just surfaces it
earlier than it would have surfaced from software patterns alone.

**`trigger_conditions` / `observable_signature`.** Both are currently free-text arrays describing tool-
call shapes and file contents (e.g. AF-0002's "a Terraform state archive from another machine is
present in the working tree"). The Deliverable 2 worked example shows these fields *can* hold a
sensor/perception-shaped description as free text without a schema change -- "the perception system's
object classification changed between tracked frames, discarding prior trajectory history" is a valid
string in the existing array. The schema does not need a new field for this. What it lacks is any
*structured* sensor-signature shape (a typed threshold, a signal name, a rate) the way
`session-source-ledger.schema.json` gives `result_shape`/`query_index` structure to retrieval calls.
Recommendation: do not add this speculatively. If Deliverable 3 (a real seed family) is ever
undertaken, design the structured shape from several real incidents, not from one hypothetical --
the retrieval-runtime family's `result_shape` enum was designed against real, cited incident mechanics
(AF-0020/0021/0025/0031/0032), not guessed in advance, and that discipline should carry over here.

## Fields and architecture that should stay software-scoped, not stretched

- `session-source-ledger.schema.json`'s `tool` enum (`search_web | fetch_url | get_file_contents |
  memory_search | call_external_tool`) and `shape` enum (`snippet | document | error | listing |
  empty_download | incomplete`) are retrieval-agent-specific by design. A physical-domain equivalent
  (a sensor reading, an actuator command, a perception classification) is not a variant of "fetching a
  document" and should not be forced into this enum. If a physical-domain session ledger is ever
  needed, it is a sibling schema, not an extension of this one.
- The entire `hotpath.json`/`INJECT.txt`/`tool-index*.jsonl` matching architecture assumes a request-
  response tool-call model with a token budget measured in the tens to low hundreds. PRD 11's own
  latency framing (a real-time control loop's tolerance is stricter than a coding agent's tool-call
  cadence, and it is a physical constraint, not a UX preference) means this architecture may not
  transfer even conceptually -- a control loop is unlikely to be calling out to a JSONL-rule matcher
  between every actuator command. This is a real, unresolved question this review does not answer:
  whether "decision-time preflight" as a *pattern* (not this specific implementation) has a viable
  embodied-agent analog at all, or whether it's fundamentally scoped to request-response agent
  architectures. Flagging as open rather than assuming either answer.

## Evidence-sourcing conventions

`incident.schema.json`'s `sources[].kind`/`authority` fields are free strings with a `primary|secondary`
enum for `authority` -- no schema change needed to cite an NTSB accident report (Deliverable 2 does
this: `kind: "government-accident-investigation-report"`, `authority: "primary"`, both valid against
the existing schema as written). The harder question is judgment, not schema: this project's existing
sourcing conventions (a GitHub issue, a CVE advisory, a court docket) were calibrated against software
incidents where the *reporting agent itself* is often the affected party (a filed bug report). NTSB/
OSHA-style investigation reports are third-party regulatory findings, produced under a different
institutional process, often months after the event, with a different relationship between "primary"
and "the affected party's own account." The existing `primary|secondary` binary held up fine for one
example; it has not been stress-tested against a body of physical-domain sourcing the way it has for
software incidents.

## Recommendation

Schema changes needed, if Deliverable 3 is taken up: one new field (`harm_domain` or equivalent,
composing with `reversibility`, not replacing it). Everything else generalizes as free text without a
schema change. The open, unresolved, and more important question is architectural, not schematic:
whether the decision-time-preflight *pattern* this project is built around has a viable embodied-agent
analog given real-time control-loop latency constraints -- that question is not answered by this
review and should be resolved before Deliverable 3, not during it.
