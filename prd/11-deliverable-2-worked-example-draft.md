# PRD 11, Deliverable 2 — Worked Example (Draft, Not Seeded)

**This is not a corpus entry.** It uses `AF-DRAFT-EMBODIED-01` deliberately, a form that cannot collide
with the real `AF-####` sequence and will never validate against `build-data.mjs`. It is not in
`fables/`, has no `AFI-####` incident record, and must not be promoted into the live corpus without a
real seeding decision made separately from this PRD. Its only purpose is validating whether
Deliverable 1's schema conclusions hold against one real, citable case.

## The real source

National Transportation Safety Board, Highway Accident Report **HAR-19/03** ("Collision Between
Vehicle Controlled by Developmental Automated Driving System and Pedestrian, Tempe, Arizona, March 18,
2018"), publicly available at https://www.ntsb.gov/investigations/accidentreports/reports/har1903.pdf.
This is a real, official, government investigation report -- primary-source-grade evidence by this
corpus's own existing classification, the same way a court docket or a vendor security advisory is
treated elsewhere in the seed corpus.

## What actually happened, per the report

The vehicle's system detected the pedestrian roughly 5.6 seconds before impact. In that interval, the
perception system's object classification cycled repeatedly -- unknown object, then vehicle, then
bicycle -- each with a different expected future path. The finding this draft is built around: **"If
the perception system changes the classification of a detected object, the tracking history of that
object is no longer considered when generating new trajectories."** Each reclassification discarded
accumulated tracking history rather than carrying it forward, so the system never accumulated enough
continuous history to predict that the pedestrian's path would cross the vehicle's lane.

This is not, on inspection, the "stale state file has no authority" shape (`AF-0002`) this PRD
originally hypothesized as the physical-domain analog. It is closer to `context-degradation` --
accumulated, relevant context repeatedly discarded rather than carried forward, the same failure shape
`AF-0001`'s freeze-language and this corpus's own long-context-compaction concerns (`context-pin.
schema.json`) describe in software terms. Worth stating plainly: the hypothesis this PRD started with
was wrong about the specific mechanism, and the honest move is to report what the source actually
shows, not to force the source to fit the original guess.

## Draft card

```yaml
id: AF-DRAFT-EMBODIED-01
slug: the-witness-that-forgot-between-frames
title: Perception reclassification discards accumulated tracking history mid-decision
status: draft-not-seeded
failure_mode: context-degradation
blast_radius: catastrophic
reversibility: irreversible
harm_domain: physical-fatality   # proposed new field -- see Deliverable 1; does not exist in the live schema yet
first_seen: 2018-03-18
incidents: []   # no AFI-#### minted; this is a draft, not a seeded pattern
trigger_conditions:
  - a tracked object's perception classification changes between sensing frames
  - the system's trajectory-prediction logic keys its history buffer to the current classification
  - the interval between first detection and a required action is short enough that repeated
    reclassification consumes most or all of the available decision time
observable_signature:
  - the same physical object is logged under more than one classification within a single tracking
    episode
  - predicted future path resets or changes sharply at each reclassification event
  - no continuous trajectory history exists at the moment an action is required, despite the object
    having been continuously observed
anti_pattern: "Discarding accumulated tracking history when an object's classification changes, as though a reclassified object is a newly appeared one rather than the same one understood better."
mitigation:
  - preserve tracking history across a reclassification event; a change in believed object type should
    refine the trajectory model, not reset it
  - treat classification confidence as a separate signal from tracking continuity -- low classification
    confidence should not zero out spatial/kinematic history that is independently well-observed
  - bound the time a single tracked object may spend unresolved between classifications before forcing
    a conservative default response
verification: "Given a simulated object whose classification changes three times within a fixed detection window, confirm the system's predicted path uses the full observation history, not only the history since the most recent classification change."
crosswalk:
  physical_domain_reference: [NTSB HAR-19/03]
provenance:
  - kind: government-accident-investigation-report
    authority: primary
    url: https://www.ntsb.gov/investigations/accidentreports/reports/har1903.pdf
license: CC0-1.0
```

## What this draft validates about Deliverable 1's conclusions

- `failure_mode: context-degradation` needed no new enum value. Confirmed generalizes.
- `trigger_conditions`/`observable_signature` held real, physical-domain content as free text without
  a schema change. Confirmed generalizes, exactly as Deliverable 1 predicted.
- `harm_domain` (proposed, not live) is used here precisely because `reversibility: irreversible` alone
  says nothing about this being a fatality rather than a data-loss event. This one worked example is
  consistent with Deliverable 1's recommendation, not fresh evidence for it -- one example cannot
  validate a schema recommendation on its own; it can only fail to contradict it, which it did not.
- `crosswalk` needed a new key (`physical_domain_reference`) rather than reuse of `owasp_asi`/
  `mitre_atlas`/etc., exactly as Deliverable 1 anticipated -- those are software-security taxonomies
  and NTSB case references are not a value that belongs in any of them.
- The open architectural question from Deliverable 1 (does decision-time preflight have a viable
  real-time-control-loop analog) is **not** resolved by this draft. This incident's actual decision
  window (~5.6 seconds) is generous compared to a tight control loop, and this example does not stress-
  test the latency question at all. That question remains open and unaddressed.

## Explicit non-outcome

This document does not conclude embodied-agent generalization is validated, ready, or a good idea to
build. It concludes one real incident's shape fits the existing schema with one proposed additive field
and no destructive changes. That is a narrower, more honest claim, and it is as far as this PRD's own
scope goes before Deliverable 3.
