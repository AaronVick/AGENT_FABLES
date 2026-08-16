import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname)
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const known = new Set(index.entries.map(entry => entry.id))
const readJsonl = file => fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const toolRules = readJsonl('tool-index.jsonl')
const utteranceRules = readJsonl('utterance-index.jsonl')
const overlaps = JSON.parse(fs.readFileSync(path.join(root, 'overlaps.json'), 'utf8'))
const inject = fs.readFileSync(path.join(root, 'INJECT.txt'), 'utf8').trim()
const injectTokens = inject.split(/\s+/).length
if (injectTokens > 80) throw new Error(`INJECT.txt exceeds 80 tokens: ${injectTokens}`)

for (const rule of [...toolRules, ...utteranceRules]) {
  if (![...rule.ids, ...rule.if_unsure].every(id => known.has(id))) throw new Error(`${rule.id} references an unknown AF ID`)
  if (rule.ids.length < 1 || rule.ids.length > 2 || rule.if_unsure.length < 1 || rule.if_unsure.length > 2) throw new Error(`${rule.id} must route to one or two IDs`)
}
for (const pair of overlaps.pairs) if (pair.ids.length !== 2 || !pair.ids.every(id => known.has(id)) || pair.if_unsure !== 'return_both') throw new Error('invalid overlap pair')

const special = {
  'AF-0012': { trigger: 'restore/checkout/reset/clean framed as cleanup', near_miss: ['git restore --staged'], do_not_infer: 'approval of cleanup is not approval of these paths', verify: [{ kind: 'git_status', dirty_paths_must_remain: true }], unverifiable: false },
  'AF-0011': { trigger: 'recursive delete or unlink after conversational approval', near_miss: [], do_not_infer: 'approval of a goal is not approval of resolved delete targets', verify: [{ kind: 'fs_unchanged', path_from: 'resolved_target' }], unverifiable: false },
  'AF-0002': { trigger: 'destroy using stale or locally discovered infrastructure state', near_miss: [], do_not_infer: 'a discovered state file has no authority over current infrastructure', verify: [{ kind: 'command_must_fail', cmd: 'terraform plan -destroy', when: 'destroy_count_or_workspace_unverified' }], unverifiable: false },
  'AF-0007': { trigger: 'success claim without an independently inspectable artifact', near_miss: [], do_not_infer: 'agent confidence is not verification', verify: [{ kind: 'unverifiable', reason: 'host must require the named independent artifact' }], unverifiable: true }
}
fs.mkdirSync(path.join(root, 'cards'), { recursive: true })
for (const entry of index.entries) {
  const fallback = { trigger: entry.trigger_conditions?.[0] ?? entry.failure_mode, near_miss: [], do_not_infer: entry.anti_pattern, verify: [{ kind: 'unverifiable', reason: 'host must translate the record verification into an independent predicate' }], unverifiable: true }
  const card = { id: entry.id, rev: index.corpus_revision, title: entry.title, ...(special[entry.id] ?? fallback), full: `signatures/${entry.id.toLowerCase()}.md` }
  const tokens = JSON.stringify(card).split(/\s+/).length
  if (tokens > 120) throw new Error(`${entry.id} hotpath card exceeds 120 tokens: ${tokens}`)
  fs.writeFileSync(path.join(root, 'cards', `${entry.id}.json`), `${JSON.stringify(card)}\n`)
}
const injectSha256 = `sha256:${crypto.createHash('sha256').update(`${inject}\n`).digest('hex')}`
const hotpathFile = path.join(root, 'hotpath.json')
const hotpath = JSON.parse(fs.readFileSync(hotpathFile, 'utf8'))
fs.writeFileSync(hotpathFile, `${JSON.stringify({ ...hotpath, inject_sha256: injectSha256 }, null, 2)}\n`)
console.log(`wrote ${index.entry_count} hotpath cards; inject=${injectSha256}`)
