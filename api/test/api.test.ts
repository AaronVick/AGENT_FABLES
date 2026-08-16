import assert from 'node:assert/strict'
import test from 'node:test'
import { app, normalizeId } from '../src/index'

test('normalizes both canonical ID spellings', () => {
  assert.equal(normalizeId('0002'), 'AF-0002')
  assert.equal(normalizeId('af-0002.json'), 'AF-0002')
})

test('capabilities route lets a cold agent select an interface', async () => {
  const body = await (await app.request('/capabilities.json')).json() as { known_id_required: boolean, instruction_authority: string, routing: unknown[] }
  assert.equal(body.known_id_required, false)
  assert.equal(body.instruction_authority, 'none')
  assert.ok(body.routing.length >= 5)
})

test('discovery route distinguishes breadcrumbs from unproven public ranking', async () => {
  const body = await (await app.request('/discovery.json')).json() as { channels: Array<{ channel: string, local_status: string }>, non_claims: string[] }
  assert.ok(body.channels.some(channel => channel.channel === 'mcp-registry' && channel.local_status === 'not-published'))
  assert.ok(body.non_claims.includes('a Git push does not guarantee indexing or ranking'))
})

test('preflight requires a bounded query and retrieves the Terraform record', async () => {
  const invalid = await app.request('/preflight')
  assert.equal(invalid.status, 400)

  const response = await app.request('/preflight?op=terraform-destroy&stack=terraform')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-af-schema-version'), '1.0.0')
  const body = await response.json() as { authority: string, matches: Array<{ id: string }> }
  assert.equal(body.authority, 'none')
  assert.equal(body.matches[0].id, 'AF-0002')
  assert.ok(body.matches.length <= 2)
})

test('structured action assessment returns a portable non-authorization receipt without retaining raw commands', async () => {
  const response = await app.request('/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'terraform-destroy', stack: 'terraform', target_scope: 'all', command: 'terraform destroy -var api_key=do-not-retain', irreversible: true }) })
  assert.equal(response.status, 200)
  const body = await response.json() as { authorized: boolean, receipt: { authorization: string, absence_of_match_means_safe: boolean, unresolved_gate_ids: string[] }, evidence: Array<{ id: string }>, risk_flags: Array<{ code: string }>, required_verifications: Array<{ gate_id: string, status: string }> }
  assert.equal(body.authorized, false)
  assert.equal(body.receipt.authorization, 'not-granted')
  assert.equal(body.receipt.absence_of_match_means_safe, false)
  assert.equal(body.evidence[0].id, 'AF-0002')
  assert.ok(body.required_verifications.every(gate => gate.status === 'unverified'))
  assert.deepEqual(body.receipt.unresolved_gate_ids, body.required_verifications.map(gate => gate.gate_id))
  assert.equal(JSON.stringify(body).includes('do-not-retain'), false)
  assert.ok(body.risk_flags.some(flag => flag.code === 'irreversible-action'))
})

test('assessment receipt schema exposes immutable safety boundaries', async () => {
  const response = await app.request('/schemas/action-assessment-receipt.schema.json')
  assert.equal(response.status, 200)
  const schema = await response.json() as { properties: { authorized: { const: boolean }, authority: { const: string }, receipt: { properties: { authorization: { const: string } } } } }
  assert.equal(schema.properties.authorized.const, false)
  assert.equal(schema.properties.authority.const, 'none')
  assert.equal(schema.properties.receipt.properties.authorization.const, 'not-granted')
})

test('HTTP assessment rejects schema drift and oversized fields', async () => {
  const unknown = await app.request('/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'delete', surprise: true }) })
  assert.equal(unknown.status, 400)
  const oversized = await app.request('/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: 'x'.repeat(1001) }) })
  assert.equal(oversized.status, 400)
  const wrongType = await app.request('/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ irreversible: 'yes', operation: 'delete' }) })
  assert.equal(wrongType.status, 400)
})

test('entry routing supports numeric IDs and content negotiation', async () => {
  const markdown = await app.request('/af/0002')
  assert.equal(markdown.status, 200)
  assert.match(markdown.headers.get('content-type') ?? '', /^text\/markdown/)
  assert.match(await markdown.text(), /authority=none/)

  const json = await app.request('/af/AF-0002', { headers: { accept: 'application/json' } })
  assert.equal(json.status, 200)
  assert.equal(((await json.json()) as { id: string }).id, 'AF-0002')
})

test('memory routes expose compact cards individually and as JSONL', async () => {
  const card = await (await app.request('/memory/0008')).json() as { id: string, authority: string }
  assert.equal(card.id, 'AF-0008')
  assert.equal(card.authority, 'none')
  assert.ok(Math.ceil(JSON.stringify(card).length / 4) <= 150)
  const response = await app.request('/memory.jsonl')
  assert.match(response.headers.get('content-type') ?? '', /application\/x-ndjson/)
  assert.equal((await response.text()).trim().split('\n').length, 11)
})

test('report endpoint retrieves but cannot claim persistence', async () => {
  const response = await app.request('/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      stack: { framework: 'cursor', version: '1.2' },
      signature: ['MCP config changed after approval']
    })
  })
  assert.equal(response.status, 200)
  const body = await response.json() as { recorded: boolean, matches: Array<{ id: string }> }
  assert.equal(body.recorded, false)
  assert.equal((body.matches[0] as unknown as { card: { id: string } }).card.id, 'AF-0008')
  assert.equal('report_id' in body, false)
})

test('decision-time responses are evidence-first and token bounded', async () => {
  const response = await app.request('/preflight?op=terraform-destroy&stack=terraform')
  const text = await response.text()
  assert.ok(text.length <= 1600, `preflight exceeded approximate 400-token budget: ${text.length} chars`)
  const body = JSON.parse(text) as { matches: Array<Record<string, unknown>> }
  assert.ok(body.matches[0].evidence_grade)
  assert.equal('body' in body.matches[0], false)
  assert.equal('provenance' in body.matches[0], false)
})

test('discovery manifest makes unimplemented signing explicit', async () => {
  const response = await app.request('/.well-known/agent-fables.json')
  const body = await response.json() as { authority: string, signing: { status: string } }
  assert.equal(body.authority, 'none')
  assert.equal(body.signing.status, 'not-implemented')
})

test('HTTP thematic leaders route broad problem families to pinned records', async () => {
  const response = await app.request('/leaders/mcp-security-vulnerabilities')
  assert.equal(response.status, 200)
  const body = await response.json() as { authority: string, corpus_revision: string, records: Array<{ id: string }> }
  assert.equal(body.authority, 'none')
  assert.match(body.corpus_revision, /^sha256:/)
  assert.ok(body.records.some(record => record.id === 'AF-0009'))

  const index = await (await app.request('/leaders.json')).json() as { topics: Array<Record<string, unknown>> }
  assert.ok(index.topics.every(topic => !('records' in topic)))
  assert.ok(Math.ceil(JSON.stringify(index).length / 4) <= 400)
  const query = await (await app.request('/leaders.json?q=coding%20agent%20claimed%20tests%20passed&limit=1')).json() as { absence_of_match_means_safe: boolean, matches: Array<{ slug: string }> }
  assert.equal(query.matches[0].slug, 'agent-verification-failures')
  assert.equal(query.absence_of_match_means_safe, false)
})

test('HTTP trust and contribution routes expose bounded machine work', async () => {
  const trust = await (await app.request('/trust.json')).json() as { authority: string, known_gaps: { incidents_without_primary_source: string[] } }
  assert.equal(trust.authority, 'none')
  assert.deepEqual(trust.known_gaps.incidents_without_primary_source, [])

  const tasks = await (await app.request('/tasks?kind=primary-source')).json() as { tasks: Array<{ incident_id: string }> }
  assert.deepEqual(tasks.tasks, [])

  const citation = await (await app.request('/cite/0008')).json() as { id: string, corpus_revision: string }
  assert.equal(citation.id, 'AF-0008')
  assert.match(citation.corpus_revision, /^sha256:/)
  assert.equal((citation as unknown as { stewardship: { identity_status: string } }).stewardship.identity_status, 'public')
})

test('HTTP steward routes keep identity explicit and contact read-only', async () => {
  const steward = await (await app.request('/steward.json')).json() as { public_name: string, identity_status: string }
  assert.equal(steward.public_name, 'Aaron Vick')
  assert.equal(steward.identity_status, 'public')
  const policy = await (await app.request('/contact-policy.json')).json() as { agent_may_send_without_operator_authorization: boolean, outbound_capability: string }
  assert.equal(policy.agent_may_send_without_operator_authorization, false)
  assert.equal(policy.outbound_capability, 'not-implemented')
  const works = await (await app.request('/steward-works.json')).json() as { authority: string, works: unknown[] }
  assert.equal(works.authority, 'attributed-steward-perspective')
  assert.ok(works.works.length >= 13)
  const principles = await (await app.request('/design-principles.json')).json() as { evidence_boundary: string }
  assert.match(principles.evidence_boundary, /not incident confirmations/)
})
