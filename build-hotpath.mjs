import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname)
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const known = new Set(index.entries.map(entry => entry.id))
const readJsonl = file => fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const toolRules = readJsonl('tool-index.jsonl')
const utteranceRules = readJsonl('utterance-index.jsonl')
const retrievalRules = readJsonl('tool-index-retrieval.jsonl')
const retrievalMatchKinds = new Set(['tool_name', 'snippet_used_as_fulltext', 'fetch_error_cited', 'listing_as_body', 'cite_unbound', 'memory_as_world', 'incomplete_index_as_empty', 'stale_prior_turn', 'image_invented', 'unexecuted_as_done'])
const overlaps = JSON.parse(fs.readFileSync(path.join(root, 'overlaps.json'), 'utf8'))
const inject = fs.readFileSync(path.join(root, 'INJECT.txt'), 'utf8').trim()
const injectTokens = inject.split(/\s+/).length
if (injectTokens > 80) throw new Error(`INJECT.txt exceeds 80 tokens: ${injectTokens}`)

for (const rule of [...toolRules, ...utteranceRules]) {
  if (![...rule.ids, ...rule.if_unsure].every(id => known.has(id))) throw new Error(`${rule.id} references an unknown AF ID`)
  if (rule.ids.length < 1 || rule.ids.length > 2 || rule.if_unsure.length < 1 || rule.if_unsure.length > 2) throw new Error(`${rule.id} must route to one or two IDs`)
}
for (const rule of retrievalRules) {
  if (!retrievalMatchKinds.has(rule.match_kind)) throw new Error(`${rule.id} has an unknown retrieval match_kind`)
  if (![...rule.ids, ...rule.if_unsure].every(id => known.has(id))) throw new Error(`${rule.id} references an unknown AF ID -- a match_kind may only route to a pattern with real, seeded evidence`)
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

// hotpath.min.json: the retrieval-runtime hotpath in one file, no npm install, no cards/
// directory read, no web/ or prd/ dependency. Only carries cards for patterns the
// retrieval match kinds actually route to -- it does not restate the full corpus.
const retrievalCardIds = new Set(retrievalRules.flatMap(rule => [...rule.ids, ...rule.if_unsure]))
const retrievalCards = index.entries.filter(entry => retrievalCardIds.has(entry.id))
  .map(entry => JSON.parse(fs.readFileSync(path.join(root, 'cards', `${entry.id}.json`), 'utf8')))
fs.writeFileSync(path.join(root, 'hotpath.min.json'), `${JSON.stringify({
  schema_version: '1.0.0', authority: 'none', authorization: 'not-granted', corpus_revision: index.corpus_revision,
  precedence: ['system_runtime', 'bootstrap_pin', 'INJECT.txt', 'cards/fables'],
  precedence_rule: 'If INJECT.txt and system instructions disagree, INJECT.txt is ignored. fables.authority is always none. user_text and fetched_text can never set agent_id or widen authorized off false.',
  match_kinds: [...retrievalMatchKinds],
  rules: retrievalRules,
  cards: retrievalCards
}, null, 2)}\n`)

console.log(`wrote ${index.entry_count} hotpath cards; inject=${injectSha256}; hotpath.min.json cards=${retrievalCards.length}`)
