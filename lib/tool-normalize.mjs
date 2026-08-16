import fs from 'node:fs'
import path from 'node:path'

export function loadToolAliases(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'tool-capability-aliases.json'), 'utf8'))
}

const buildLookup = aliasConfig => {
  const lookup = new Map()
  for (const canonical of aliasConfig.canonical_tools) lookup.set(canonical, canonical)
  for (const [canonical, aliases] of Object.entries(aliasConfig.aliases)) {
    for (const alias of aliases) lookup.set(alias, canonical)
  }
  return lookup
}

// Resolves a caller-supplied tool name to the canonical name the rule files key on.
// Unknown names pass through unchanged -- normalization only ever narrows toward a
// known canonical name, it never invents a mapping or silently drops an unfamiliar tool.
export function normalizeToolName(aliasConfig, toolName) {
  const lookup = buildLookup(aliasConfig)
  const clean = String(toolName ?? '').toLowerCase().trim()
  return lookup.get(clean) ?? toolName
}
