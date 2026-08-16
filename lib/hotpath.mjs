import fs from 'node:fs'
import path from 'node:path'

const jsonl = file => fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line))
const clean = value => String(value ?? '').toLowerCase()

export function loadHotpath(root) {
  return {
    toolRules: jsonl(path.join(root, 'tool-index.jsonl')),
    utteranceRules: jsonl(path.join(root, 'utterance-index.jsonl')),
    cards: new Map(fs.readdirSync(path.join(root, 'cards')).filter(file => /^AF-\d{4}\.json$/.test(file)).map(file => { const card = JSON.parse(fs.readFileSync(path.join(root, 'cards', file), 'utf8')); return [card.id, card] })),
    revision: JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8')).corpus_revision
  }
}

export function toolPreflight(data, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !String(input.tool ?? '').trim()) throw new Error('hotpath input requires a tool')
  const command = clean(input.command ?? (Array.isArray(input.argv) ? input.argv.join(' ') : ''))
  const tool = clean(input.tool)
  const pathValue = clean(input.path)
  const packageValue = clean(input.package)
  const mcpTool = clean(input.mcp_tool)
  const nearMiss = data.toolRules.find(rule => clean(rule.tool) === tool && rule.not.some(value => command.includes(clean(value))))
  const toolHit = data.toolRules.find(rule => {
    if (clean(rule.tool) !== tool && (!rule.mcp_tool || clean(rule.mcp_tool) !== mcpTool)) return false
    if (rule.not.some(value => command.includes(clean(value)))) return false
    return rule.argv_any.some(value => command.includes(clean(value))) || (rule.argv_all.length > 0 && rule.argv_all.every(value => command.includes(clean(value)))) || (rule.path_regex && new RegExp(rule.path_regex, 'i').test(pathValue)) || (rule.package && packageValue.includes(clean(rule.package))) || (rule.mcp_tool && clean(rule.mcp_tool) === mcpTool)
  })
  const utteranceHit = data.utteranceRules.find(rule => rule.phrases.some(phrase => clean(input.utterance).includes(clean(phrase))))
  let ids = toolHit?.ids ?? utteranceHit?.ids ?? []
  let reason = ids.length ? 'corpus_hit' : nearMiss ? 'near_miss_only' : 'no_corpus_hit'
  if (toolHit && utteranceHit && new Set([...toolHit.if_unsure, ...utteranceHit.if_unsure]).size > 1) { ids = [...new Set([...toolHit.ids, ...utteranceHit.ids, ...toolHit.if_unsure, ...utteranceHit.if_unsure])].slice(0, 2); reason = 'ambiguous' }
  if (ids.length === 0) return { schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'none', reason, authority: 'none', authorized: false, corpus_revision: data.revision, trigger_id: nearMiss?.id ?? null, cards: [], similar_rejected: (nearMiss?.ids ?? []).slice(0, 2), required_verifications: [{ id: 'independent_artifact_before_mutate', status: 'unverified' }], cite: null }
  const cards = ids.map(id => data.cards.get(id)).filter(Boolean)
  return { schema_version: '1.0.0', route: 'tool-call-hotpath', match: 'hit', reason, authority: 'none', authorized: false, corpus_revision: data.revision, trigger_id: toolHit?.id ?? utteranceHit?.id ?? null, cards, similar_rejected: [], required_verifications: cards.flatMap(card => card.verify.map((predicate, index) => ({ id: `${card.id.toLowerCase()}-predicate-${index + 1}`, status: 'unverified', predicate }))), cite: cards.map(card => ({ id: card.id, corpus_revision: data.revision, card_rev: card.rev, source: 'card' })) }
}
