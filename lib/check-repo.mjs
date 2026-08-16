import fs from 'node:fs'
import path from 'node:path'

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache'])
const maxFiles = 10000
const maxBytes = 1024 * 1024
const maxFindings = 50

function ignorePrefixes(root) {
  const ignoreFile = path.join(root, '.agentfablesignore')
  if (!fs.existsSync(ignoreFile)) return []
  return fs.readFileSync(ignoreFile, 'utf8').split(/\r?\n/)
    .map(line => line.trim().replace(/^\.\//, '')).filter(line => line && !line.startsWith('#'))
}

function filesUnder(root, ignoredPrefixes) {
  const found = []
  const walk = directory => {
    if (found.length >= maxFiles) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (found.length >= maxFiles) break
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (ignoredPrefixes.some(prefix => relative === prefix.replace(/\/$/, '') || relative.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))) continue
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(absolute)
      } else if (entry.isFile()) found.push(absolute)
    }
  }
  walk(root)
  return found
}

export function checkRepository(root, corpus, corpusRevision, ruleManifest) {
  const canonicalRoot = fs.realpathSync(root)
  const entries = new Map(corpus.map(entry => [entry.id, entry]))
  const findings = []
  const ignoredPrefixes = ignorePrefixes(canonicalRoot)
  const files = filesUnder(canonicalRoot, ignoredPrefixes)
  for (const absolute of files) {
    const relative = path.relative(canonicalRoot, absolute).split(path.sep).join('/')
    const stat = fs.statSync(absolute)
    for (const rule of ruleManifest.rules) {
      if (rule.path_regex && !new RegExp(rule.path_regex, 'i').test(relative)) continue
      if (rule.path_filter && !new RegExp(rule.path_filter, 'i').test(relative)) continue
      let matched = Boolean(rule.path_regex && !rule.content_regex)
      if (rule.content_regex) {
        if (stat.size > maxBytes) continue
        const content = fs.readFileSync(absolute, 'utf8')
        matched = new RegExp(rule.content_regex, 'im').test(content)
      }
      if (!matched) continue
      const entry = entries.get(rule.pattern_id)
      if (findings.length < maxFindings) findings.push({
        rule_id: rule.rule_id, pattern_id: rule.pattern_id, kind: rule.kind, severity: rule.severity,
        path: relative, summary: rule.summary, canonical_url: entry?.canonical_url,
        affected_versions: entry?.affected_versions, fixed_in: entry?.fixed_in,
        verification: entry?.verification,
        breadcrumb: `${rule.summary} (pattern: ${rule.pattern_id}, ${entry?.canonical_url})`
      })
    }
  }
  const severity_counts = Object.fromEntries(['critical', 'high', 'medium', 'low'].map(severity => [severity, findings.filter(finding => finding.severity === severity).length]))
  return {
    schema_version: '1.0.0', route: 'offline-repository-check', authority: 'none', authorized: false,
    corpus_revision: corpusRevision, root: '.', scanned_files: files.length,
    truncated: files.length >= maxFiles || findings.length >= maxFindings, finding_count: findings.length,
    ignored_prefixes: ignoredPrefixes.length, severity_counts,
    findings: findings.sort((a, b) => a.path.localeCompare(b.path) || a.rule_id.localeCompare(b.rule_id)),
    receipt: { authorization: 'not-granted', absence_of_findings_means_safe: false }
  }
}
