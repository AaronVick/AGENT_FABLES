const normalizeUrl = value => {
  try {
    const url = new URL(String(value))
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export function checkExternalCitations(transcript) {
  if (!transcript || typeof transcript !== 'object') throw new Error('transcript is required')
  const toolCalls = Array.isArray(transcript.tool_calls) ? transcript.tool_calls : []
  const citations = Array.isArray(transcript.citations) ? transcript.citations : []

  const fetchedUrls = new Set(
    toolCalls
      .filter(call => ['fetch_url', 'search_web'].includes(String(call?.tool)))
      .flatMap(call => [call.url, ...(Array.isArray(call.result_urls) ? call.result_urls : [])])
      .map(normalizeUrl)
      .filter(Boolean)
  )

  const valid = []
  const invalid = []
  for (const citation of citations) {
    const normalized = normalizeUrl(citation?.url)
    const matchedToolCall = normalized ? toolCalls.find(call =>
      ['fetch_url', 'search_web'].includes(String(call?.tool)) &&
      (normalizeUrl(call.url) === normalized || (Array.isArray(call.result_urls) && call.result_urls.some(url => normalizeUrl(url) === normalized)))
    ) : null
    if (normalized && fetchedUrls.has(normalized) && matchedToolCall) {
      valid.push({ url: citation.url, matched_tool_call: matchedToolCall.tool })
    } else {
      invalid.push({ url: citation?.url ?? null, reason: normalized ? 'url_without_a_successful_fetch_or_search_call_in_the_same_session' : 'invalid_or_missing_url' })
    }
  }

  return {
    schema_version: '1.0.0',
    rule: 'fetch-or-silence',
    authority: 'none',
    related_pattern: 'AF-0018',
    valid,
    invalid,
    pass_rate: citations.length === 0 ? 1 : valid.length / citations.length
  }
}
