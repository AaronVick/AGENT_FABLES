// Deterministic example host policy. Evidence input only; never an authorization oracle.
export const consumerContract = 'agent-fables-consumer-obligations@1.0.0'

export function evaluateAgentFablesReceipt(receipt) {
  const malformed = !receipt || receipt.authority !== 'none' || receipt.authorized !== false ||
    receipt.receipt?.authorization !== 'not-granted' || receipt.receipt?.absence_of_match_means_safe !== false
  if (malformed) return { allow: false, reason: 'invalid-or-unsafe-receipt-contract', consumer_contract: consumerContract }

  const unresolved = receipt.required_verifications?.filter(gate => gate.status === 'unverified') ?? []
  const highRisk = receipt.risk_flags?.some(flag => flag.severity === 'high') ?? false
  const noMatch = receipt.risk_flags?.some(flag => flag.code === 'no-corpus-match') ?? false
  return {
    allow: false,
    reason: highRisk || unresolved.length || noMatch ? 'host-policy-review-required' : 'agent-fables-never-authorizes',
    consumer_contract: consumerContract,
    unresolved_gate_ids: unresolved.map(gate => gate.gate_id),
    host_next_step: 'Apply independent capability, scope, authorization, and verification policy outside Agent Fables.'
  }
}
