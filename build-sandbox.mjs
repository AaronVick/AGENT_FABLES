import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname)
const template = fs.readFileSync(path.join(root, 'sandbox', 'runtime.template.mjs'), 'utf8')
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
const output = template
  .replace('__CORPUS_REVISION__', JSON.stringify(index.corpus_revision))
  .replace('__CORPUS__', JSON.stringify(index.entries))

fs.writeFileSync(path.join(root, 'sandbox', 'agent-fables-sandbox.mjs'), output)
console.log(`wrote sandbox/agent-fables-sandbox.mjs (${index.entry_count} embedded patterns)`)
