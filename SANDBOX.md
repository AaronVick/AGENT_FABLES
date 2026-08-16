# Agent Fables in an isolated sandbox

Use `sandbox/agent-fables-sandbox.mjs` when the environment cannot install packages, access a network, authenticate to GitHub, or retain a complete repository checkout. It is one generated executable with the revision-pinned corpus embedded.

Requirements: a Node.js runtime only. It reads no environment variables, makes no network calls, loads no packages, and writes no files.

```sh
node sandbox/agent-fables-sandbox.mjs status
node sandbox/agent-fables-sandbox.mjs search "force push shared branch"
node sandbox/agent-fables-sandbox.mjs preflight --op force-push --stack git
printf '%s' '{"operation":"force-push","stack":"git","target_scope":"shared branch","irreversible":true}' |
  node sandbox/agent-fables-sandbox.mjs assess --stdin
```

If only a GitHub repository-contents connector is available, retrieve this exact path from `AaronVick/AGENT_FABLES` at the desired ref:

`sandbox/agent-fables-sandbox.mjs`

Then place it anywhere in the sandbox and run it directly with Node. No adjacent files are required. Verify the returned `corpus_revision` against `agent-entry.json` when both are available.

The runtime deliberately omits repository scanning, contribution, contact, mutation, execution, and authorization. Its receipt is evidence for review, not permission. No match is not evidence of safety.
