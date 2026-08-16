import fs from 'node:fs'
import path from 'node:path'
import { verifyInstallation } from './verify.mjs'

export function launchAudit(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const corpus = fs.readFileSync(path.join(root, 'index.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  const steward = JSON.parse(fs.readFileSync(path.join(root, 'steward.json'), 'utf8'))
  const contactPolicy = JSON.parse(fs.readFileSync(path.join(root, 'contact-policy.json'), 'utf8'))
  const verification = verifyInstallation(root)
  const checks = {
    seed_patterns_at_least_10: corpus.length >= 10,
    exact_artifacts_across_3_patterns: corpus.filter(entry => entry.exact_signatures.length > 0).length >= 3,
    offline_agent_cli: Boolean(pkg.bin?.['agent-fables']),
    license_present: fs.existsSync(path.join(root, 'LICENSE')),
    security_model_present: fs.existsSync(path.join(root, 'SECURITY.md')),
    agent_routes_present: fs.existsSync(path.join(root, 'AGENT-ROUTES.md')),
    contributing_agents_present: fs.existsSync(path.join(root, 'CONTRIBUTING_AGENTS.md')),
    least_privilege_ci_present: fs.existsSync(path.join(root, '.github/workflows/verify.yml')),
    machine_change_template_present: fs.existsSync(path.join(root, '.github/PULL_REQUEST_TEMPLATE.md')),
    desired_repository_metadata_present: fs.existsSync(path.join(root, 'repository-metadata.json')),
    mcp_stdio_server_present: fs.existsSync(path.join(root, 'mcp/server.mjs')),
    package_runtime_uses_packaged_corpus: ['bin/agent-fables.mjs', 'mcp/server.mjs'].every(file => {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      return source.includes('index.jsonl') && !source.includes('api/src') && !source.includes('web/src')
    }),
    steward_contract_present: fs.existsSync(path.join(root, 'STEWARD.md')) && fs.existsSync(path.join(root, 'schemas/steward.schema.json')),
    contact_policy_safe: contactPolicy.agent_may_send_without_operator_authorization === false && contactPolicy.outbound_capability === 'not-implemented',
    agent_capabilities_manifest_present: fs.existsSync(path.join(root, 'capabilities.json')),
    thematic_leaders_present: fs.existsSync(path.join(root, 'leaders.json')) && fs.existsSync(path.join(root, 'leaders', 'destructive-agent-operations.md')),
    offline_integrity_verification_passes: verification.verified,
    repository_checker_rules_present: fs.existsSync(path.join(root, 'scanner-rules.json')) && fs.existsSync(path.join(root, 'lib/check-repo.mjs')),
    public_steward_contact_configured: steward.identity_status === 'public' && Boolean(steward.public_name) && steward.public_contact.length > 0 && contactPolicy.contact_status === 'open-under-policy',
    git_repository_initialized: fs.existsSync(path.join(root, '.git')),
    package_publish_guard_removed: pkg.private !== true,
    canonical_repository_url_set: Boolean(pkg.repository?.url),
    mcp_registry_manifest_present: fs.existsSync(path.join(root, 'server.json')),
    mcp_package_published: false,
    mcp_registry_entry_verified: false,
    github_topics_configured: false,
    public_endpoints_verified: false
  }
  const localRequired = ['seed_patterns_at_least_10', 'exact_artifacts_across_3_patterns', 'offline_agent_cli', 'license_present', 'security_model_present', 'agent_routes_present', 'contributing_agents_present', 'least_privilege_ci_present', 'machine_change_template_present', 'desired_repository_metadata_present', 'mcp_stdio_server_present', 'mcp_registry_manifest_present', 'package_runtime_uses_packaged_corpus', 'steward_contract_present', 'contact_policy_safe', 'agent_capabilities_manifest_present', 'offline_integrity_verification_passes', 'repository_checker_rules_present']
  const publicRequired = Object.keys(checks)
  return {
    route: 'launch-audit',
    checks,
    local_artifact_readiness: localRequired.every(key => checks[key]),
    public_git_readiness: publicRequired.every(key => checks[key]),
    blockers: publicRequired.filter(key => !checks[key]),
    notes: {
      github_topics_configured: 'External repository metadata cannot be proven before a repository exists.',
      public_endpoints_verified: 'Requires explicit post-deployment verification; never infer from local builds.',
      mcp_package_published: 'The stdio server works locally; npm publication requires explicit authorization.',
      mcp_registry_entry_verified: 'Registry publication and lookup are external facts verified only after package publication.',
      package_publish_guard_removed: 'Keep private=true until publication is explicitly authorized.'
      , public_steward_contact_configured: checks.public_steward_contact_configured
        ? 'A public steward route exists; contact remains subject to operator authorization and contact-policy.json.'
        : 'Optional outreach remains closed until the steward explicitly supplies a public name and contact route and opens the policy.'
    }
  }
}
