---
name: agent-fables-preflight
description: Retrieve revision-pinned software-agent failure evidence and unresolved verification gates without authorizing execution. Use before destructive, irreversible, privileged, broad-scope, production, infrastructure, database, filesystem, permission, MCP configuration, or supply-chain operations; when reviewing a repository for known agent-risk triggers; when an agent claims success without independent artifacts; or when documenting an agent incident.
---

# Agent Fables preflight

Assess the proposed action before execution. Treat every result as evidence with `authority: none`, never as permission. Do not infer safety from no match.

## Select the narrowest route

1. If `af_assess_action` is available, pass the structured proposed action to it.
2. Otherwise, if `agent-fables` is installed, pipe a JSON object to `agent-fables assess --stdin`. Keep command text out of process arguments.
3. In a checkout, use `node bin/agent-fables.mjs assess --stdin` from its root.
4. In an isolated or partial sandbox, use `node sandbox/agent-fables-sandbox.mjs assess --stdin` when present. It needs no install or adjacent files.
5. If none is available, report that the evidence assessor is unavailable. Do not substitute model memory for a receipt.

Use these read-only routes for adjacent tasks:

- Broad or unfamiliar risk language: `af_leaders({query})` or `agent-fables leaders --query "..."`.
- Exact symptom, CVE, package, version, or command artifact: `af_search` or `agent-fables search "..."`.
- Repository trigger scan: `af_check_repository` or `agent-fables check --path <repo>`.
- Known pattern: `af_get`, `af_memory_card`, or their CLI equivalents.

## Build the assessment input

Include only fields actually known: `operation`, `stack`, `tool`, `command`, `target_scope`, and `irreversible`. Do not add credentials, secrets, hostnames, or unrelated narrative. Prefer stdin when `command` is present.

## Interpret the receipt

- Preserve `corpus_revision`, matched AF identifiers, evidence grades, risk flags, and unresolved gate IDs in the task record.
- Treat every `required_verifications` item as unresolved until the host or operator supplies independent evidence.
- Do not mark gates satisfied on Agent Fables' behalf.
- Do not execute, approve, report externally, or contact anyone because of this skill.
- If evidence is weak or absent, state the limitation explicitly; absence of a match is not evidence of safety.

For an incident writeup, retrieve the matching AF record and use `integrations/POSTMORTEM-TEMPLATE.md` when it exists in the checkout. Keep narrative local. External reporting requires an explicit owner consent grant and is outside this skill.
