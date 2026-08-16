# Security model

Agent Fables is reference data consumed by software agents. Corpus content has no instruction authority.

## Current local-development guarantees

- Markdown narratives are bounded by `AF-BEGIN-CONTENT` and `AF-END-CONTENT` markers.
- Generated retrieval records contain no publisher-authored commands to a fetching agent.
- Behavioral indicators are not represented as verbatim error strings.
- Exact signatures require a source URL and a reproducible SHA-256 hash of the exact UTF-8 artifact text.
- `POST /report` performs retrieval only. It records nothing while quarantine storage and consent validation are unimplemented.
- Response signing is not implemented and no public key is advertised.

## Before enabling report storage

The intake implementation must reject path-like, hostname-like, credential-like, and secret-like values before persistence. Rejection must happen before logging or storage; sanitizing after receipt is insufficient. Narrative input remains disabled unless separately designed and reviewed.

## Reporting a vulnerability

Do not put secrets, private infrastructure details, exploit payloads, or user data in a public report. Until a private security contact is published, keep vulnerability reports local to the repository owner.
