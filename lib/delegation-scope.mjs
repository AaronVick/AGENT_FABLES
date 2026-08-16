// Implements delegation-scope.json's resolutions_never_inherit_as_clearance rule.

export function buildDelegationRecord(parentAgentId, childAgentId, parentResolution, childTask) {
  if (!childAgentId || !childTask) throw new Error('a delegation record requires child_agent_id and child_task')
  return {
    parent_agent_id: parentAgentId ?? null,
    child_agent_id: childAgentId,
    parent_resolution: parentResolution ?? null,
    child_task: childTask,
    parent_resolution_binding_on_child: false,
    child_must_independently_resolve: true,
    note: 'parent_resolution is included for context only. It authorizes nothing for the child. The child must run its own authority-precedence and request-framing checks against its own action before proceeding.'
  }
}

// Deliberately does not attempt to detect whether the child's task IS the action the
// parent was blocked on -- that requires semantic judgment this function does not have.
// It only enforces what is mechanically true by construction: a delegation record never
// carries clearance forward, regardless of what the parent already resolved.
export function requiresIndependentResolution(delegationRecord) {
  return Boolean(delegationRecord?.child_must_independently_resolve)
}
