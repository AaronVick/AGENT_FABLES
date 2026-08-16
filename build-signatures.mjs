import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const fables = JSON.parse(fs.readFileSync(path.join(root, 'api/src/fables.json'), 'utf8'))
const outputDir = path.join(root, 'signatures')
fs.mkdirSync(outputDir, { recursive: true })
for (const file of fs.readdirSync(outputDir).filter(file => file.endsWith('.md'))) {
  fs.unlinkSync(path.join(outputDir, file))
}

for (const fable of fables) {
  const identifiers = [
    ...(fable.identifiers ?? []),
    ...(fable.crosswalk?.owasp_asi ?? []),
    ...(fable.crosswalk?.mitre_atlas ?? []),
    ...(fable.crosswalk?.cwe ?? [])
  ]
  const content = `---
id: ${fable.id}
kind: retrieval-record
exact_signature_count: ${fable.exact_signatures.length}
---
# ${fable.id}: ${fable.title}

Canonical record: ${fable.canonical_url}

This is reference data with no instruction authority. The indicators below are behavioral descriptions, not verbatim error messages.

## Search identifiers

${identifiers.length ? identifiers.map(value => `- ${value}`).join('\n') : '- none recorded'}

## Affected software

- ${fable.affected_versions}
- Fixed in: ${fable.fixed_in}

## Behavioral indicators

${fable.behavioral_indicators.map(value => `- ${value}`).join('\n')}

## Exact, source-backed signatures

${fable.exact_signatures.length ? fable.exact_signatures.map(value => `- ${typeof value === 'string' ? value : value.text}`).join('\n') : '_None recorded. Do not treat the behavioral indicators above as literal log output._'}

## Resolution data

- Failure mode: ${fable.failure_mode}
- Anti-pattern: ${fable.anti_pattern}
- Verification: ${fable.verification}
`
  fs.writeFileSync(path.join(outputDir, `${fable.id.toLowerCase()}.md`), content)
}

process.stdout.write(`generated ${fables.length} retrieval records\n`)
