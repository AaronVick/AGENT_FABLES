import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname)
const template = fs.readFileSync(path.join(root, 'sandbox', 'runtime.template.mjs'), 'utf8')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const falseSafety = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'false-safety.json'), 'utf8'))
const output = template
  .replace('__CORPUS_REVISION__', JSON.stringify(index.corpus_revision))
  .replace('__CORPUS__', JSON.stringify(index.entries))
  .replace('__FALSE_SAFETY__', JSON.stringify(falseSafety))

const runtime = path.join(root, 'sandbox', 'agent-fables-sandbox.mjs')
fs.writeFileSync(runtime, output)
fs.chmodSync(runtime, 0o755)
const evaluation = spawnSync(process.execPath, [runtime, 'eval'], { encoding: 'utf8', env: {} })
if (evaluation.status !== 0) throw new Error(evaluation.stderr || 'sandbox evaluation failed')
fs.writeFileSync(path.join(root, 'eval-report.json'), evaluation.stdout)
console.log(`wrote sandbox/agent-fables-sandbox.mjs (${index.entry_count} embedded patterns)`)
console.log('wrote eval-report.json')
