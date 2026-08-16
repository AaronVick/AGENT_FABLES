#!/usr/bin/env node
// Growth-simulation harness -- prd/09-retrieval-robustness-at-scale.md, Deliverable 5.
//
// Honest limitation, stated up front: this cannot generate genuinely novel paraphrased incidents
// without a model call, which would violate the no-LLM-in-the-request-path rule this corpus holds as
// architectural (see PRD 00/01). What it CAN do, zero-LLM, deterministically: clone real entries with
// light, fixed-vocabulary lexical perturbation (word-order shuffle, a small synonym table) to
// approximate the vocabulary-densification effect of many distinct real incidents landing in the same
// failure_mode bucket. This is a proxy, not a simulation of real incident diversity -- it will
// understate how differently two REAL new incidents in the same bucket would actually be worded. Read
// its output as a lower bound on future robustness, not a forecast.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rankEntries } from '../lib/retrieval.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const queries = [
  ...JSON.parse(JSON.stringify(await import('js-yaml').then(yaml => yaml.load(fs.readFileSync(path.join(root, 'evals/discovery-queries.yaml'), 'utf8'))))),
  ...JSON.parse(JSON.stringify(await import('js-yaml').then(yaml => yaml.load(fs.readFileSync(path.join(root, 'evals/adversarial-discovery.yaml'), 'utf8')))))
]

const SYNONYMS = {
  agent: ['assistant', 'model', 'system'], tool: ['utility', 'component'], failed: ['broke', 'errored'],
  destructive: ['irreversible', 'damaging'], stale: ['outdated', 'obsolete'], content: ['payload', 'data'],
  fetch: ['retrieve', 'download'], result: ['output', 'response'], search: ['query', 'lookup']
}

function perturb(text, seed) {
  const words = String(text).split(/\s+/)
  let s = seed
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  const swapped = words.map(word => {
    const key = word.toLowerCase().replace(/[^a-z]/g, '')
    if (SYNONYMS[key] && rand() < 0.4) return SYNONYMS[key][Math.floor(rand() * SYNONYMS[key].length)]
    return word
  })
  // light word-order jitter: swap adjacent pairs with low probability
  for (let i = 0; i < swapped.length - 1; i++) if (rand() < 0.15) [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
  return swapped.join(' ')
}

function clone(entry, n, densityIndex) {
  const seed = densityIndex * 7919 + n * 104729
  return {
    ...entry,
    id: `${entry.id}-CLONE-${densityIndex}-${n}`,
    behavioral_indicators: entry.behavioral_indicators.map((line, i) => perturb(line, seed + i)),
    trigger_conditions: (entry.trigger_conditions ?? []).map((line, i) => perturb(line, seed + 100 + i)),
    anti_pattern: perturb(entry.anti_pattern, seed + 200)
  }
}

function measure(corpus) {
  let fail = 0
  const margins = []
  for (const fixture of queries) {
    const [top1, top2] = rankEntries(corpus, fixture.query, 2)
    if (top1?.entry.id !== fixture.expected) fail++
    if (top2) margins.push(top1.specificity - top2.specificity)
  }
  return {
    corpus_size: corpus.length,
    fixtures: queries.length,
    fails: fail,
    recall_at_1: (queries.length - fail) / queries.length,
    min_margin: margins.length ? Number(Math.min(...margins).toFixed(3)) : null
  }
}

const densities = [1, 2, 5, 10]
const results = densities.map(density => {
  const clonesPerEntry = density - 1
  const synthetic = index.entries.flatMap(entry =>
    Array.from({ length: clonesPerEntry }, (_, n) => clone(entry, n, density)))
  return measure([...index.entries, ...synthetic])
})

console.log(JSON.stringify({
  schema_version: '1.0.0',
  method: 'zero-LLM lexical-perturbation clones -- a lower bound proxy, not a forecast; see file header',
  corpus_revision: index.corpus_revision,
  results
}, null, 2))

const collapsed = results.find(r => r.recall_at_1 < 0.9 || (r.min_margin !== null && r.min_margin < 0.10))
if (collapsed) {
  console.error(`growth simulation: robustness degrades at corpus_size=${collapsed.corpus_size} (recall_at_1=${collapsed.recall_at_1}, min_margin=${collapsed.min_margin})`)
  process.exitCode = 1
}
