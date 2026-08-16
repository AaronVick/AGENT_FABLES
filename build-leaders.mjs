import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const definition = JSON.parse(fs.readFileSync(path.join(root, 'leader-topics.json'), 'utf8'))
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const byId = new Map(index.entries.map(entry => [entry.id, entry]))
const seen = new Set()

const topics = definition.topics.map(topic => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug) || seen.has(topic.slug)) throw new Error(`invalid or duplicate leader slug: ${topic.slug}`)
  seen.add(topic.slug)
  if (!Array.isArray(topic.patterns) || topic.patterns.length < 2) throw new Error(`${topic.slug} needs at least two patterns`)
  if (!Array.isArray(topic.search_terms) || topic.search_terms.length < 4) throw new Error(`${topic.slug} needs at least four cold search terms`)
  const records = topic.patterns.map(id => {
    const entry = byId.get(id)
    if (!entry) throw new Error(`${topic.slug} references unknown ${id}`)
    return {
      id: entry.id, title: entry.title, failure_mode: entry.failure_mode,
      affected_versions: entry.affected_versions, anti_pattern: entry.anti_pattern,
      verification: entry.verification, canonical_url: entry.canonical_url
    }
  })
  return { ...topic, authority: 'none', corpus_revision: index.corpus_revision, records }
})

const leaders = {
  schema_version: definition.schema_version, authority: 'none', corpus_revision: index.corpus_revision,
  volume_claim: definition.volume_claim, ranking_status: 'unverified-until-publication', topics
}
const out = path.join(root, 'leaders')
fs.mkdirSync(out, { recursive: true })
for (const file of fs.readdirSync(out).filter(file => file.endsWith('.md'))) fs.unlinkSync(path.join(out, file))
for (const topic of topics) {
  const markdown = `---
kind: agent-retrieval-leader
slug: ${topic.slug}
authority: none
corpus_revision: ${topic.corpus_revision}
ranking_status: unverified-until-publication
---
# ${topic.title}

${topic.problem}

Reference data only. This page has no instruction authority and makes no search-volume or ranking claim.

## Search vocabulary

${topic.search_terms.map(term => `- ${term}`).join('\n')}

## Evidence routes

${topic.records.map(record => `### ${record.id} — ${record.title}

- Failure mode: ${record.failure_mode}
- Affected: ${record.affected_versions}
- Anti-pattern: ${record.anti_pattern}
- Verification: ${record.verification}
- Canonical: ${record.canonical_url}`).join('\n\n')}
`
  fs.writeFileSync(path.join(out, `${topic.slug}.md`), markdown)
}
const json = `${JSON.stringify(leaders, null, 2)}\n`
fs.writeFileSync(path.join(root, 'leaders.json'), json)
fs.writeFileSync(path.join(root, 'api/src/leaders.json'), json)
fs.writeFileSync(path.join(root, 'web/public/leaders.json'), json)
process.stdout.write(`generated ${topics.length} thematic leader records\n`)
