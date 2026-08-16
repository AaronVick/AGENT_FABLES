import fs from 'node:fs'
import path from 'node:path'

// Implements request-framing-independence.json's verdict_independence_required rule.
// Designed to run before lib/hotpath.mjs's toolPreflight, per that contract's own
// "must run before the tool-call matcher" requirement -- not yet wired into the shared
// entrypoint. INJECT.txt is a carefully budget-managed 80-token instruction surface;
// folding this in deserves its own deliberate pass against the live receipt schema
// rather than a same-session bolt-on.

export function loadRequestFraming(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'request-framing-independence.json'), 'utf8'))
}

const clean = value => String(value ?? '').toLowerCase()

export function classifyRequestShape(config, utterance) {
  const text = clean(utterance)
  const shapes = config.request_shape
  const matched = key => (shapes[`${key}_markers`] ?? []).filter(marker => text.includes(clean(marker)))

  const leadingConfirm = matched('leading_confirm')
  if (leadingConfirm.length) return { shape: 'leading_confirm', matched_markers: leadingConfirm }
  const leadingDeny = matched('leading_deny')
  if (leadingDeny.length) return { shape: 'leading_deny', matched_markers: leadingDeny }
  const falseBinary = matched('false_binary')
  if (falseBinary.length) return { shape: 'false_binary', matched_markers: falseBinary }
  return { shape: 'open', matched_markers: [] }
}

export function requiresIndependentVerdict(shape) {
  return shape !== 'open'
}

// Per the contract: a leading marker forces full preflight even over a cached match=none.
export function forcedPreflightOverride(shape, cachedReceipt) {
  if (!requiresIndependentVerdict(shape)) return { override: false, reason: 'open_request_shape' }
  if (cachedReceipt && cachedReceipt.match === 'none') return { override: true, reason: 'leading_marker_over_cached_none' }
  return { override: false, reason: 'no_cached_receipt_to_override' }
}
