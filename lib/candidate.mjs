const allowedFields = new Set(['kind', 'source_url', 'title', 'target_id', 'occurred_at', 'framework', 'version', 'failure_mode_guess', 'generic_signatures'])
const kinds = new Set(['new-incident', 'source-addition', 'exact-artifact', 'retrieval-miss', 'integration-mapping'])
const unsafe = value => /(?:^|\s)(?:\/[^\s]+|[A-Za-z]:\\)|(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{12,})|(?:password|secret|token)\s*[:=]/i.test(value)

export function validateCandidate(candidate) {
  if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object') throw new Error('candidate must be one JSON object')
  const unknown = Object.keys(candidate).filter(key => !allowedFields.has(key))
  if (unknown.length) throw new Error(`unknown candidate fields: ${unknown.join(', ')}`)
  if (!kinds.has(candidate.kind)) throw new Error('candidate kind is invalid')
  if (typeof candidate.source_url !== 'string' || !candidate.source_url.startsWith('https://') || !URL.canParse(candidate.source_url)) throw new Error('candidate requires one HTTPS source_url')
  if (typeof candidate.title !== 'string' || candidate.title.length < 3 || candidate.title.length > 160) throw new Error('candidate title must be 3-160 characters')
  if (candidate.target_id !== undefined && !/^(?:AF|AFI)-\d{4}$/.test(candidate.target_id)) throw new Error('target_id must be AF-#### or AFI-####')
  if (candidate.occurred_at !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(candidate.occurred_at)) throw new Error('occurred_at must be YYYY-MM-DD')
  for (const field of ['framework', 'version', 'failure_mode_guess']) if (candidate[field] !== undefined && (typeof candidate[field] !== 'string' || candidate[field].length > 80)) throw new Error(`${field} must be a string no longer than 80 characters`)
  if (candidate.generic_signatures !== undefined && (!Array.isArray(candidate.generic_signatures) || candidate.generic_signatures.length > 5 || candidate.generic_signatures.some(value => typeof value !== 'string' || !value || value.length > 160))) throw new Error('generic_signatures must contain at most five 1-160 character strings')
  const minimizedValues = [candidate.title, candidate.framework, candidate.version, candidate.failure_mode_guess, ...(candidate.generic_signatures ?? [])].filter(Boolean)
  if (minimizedValues.some(unsafe)) throw new Error('candidate contains a path or credential-like material; remove it before validation')
  return {
    route: 'offline-evidence-candidate-validation', valid_candidate: true, evidence_accepted: false,
    submission_performed: false, persistence_performed: false, authority: 'none', candidate
  }
}
