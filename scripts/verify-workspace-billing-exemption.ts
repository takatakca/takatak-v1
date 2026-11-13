import { isBillingExemptWorkspace } from '../src/lib/billing/billing-exemption-policy';
import { resolveEffectiveSocialEntitlements } from '../src/lib/billing/social/subscription-lifecycle';

const workspaceId = '614c6e69-3006-422b-9aa8-00fba5f4ff94';
const secondWorkspaceId = 'a821433e-fae5-4e0c-a9f4-742150961687';
const otherWorkspaceId = '614c6e69-3006-422b-9aa8-00fba5f4ff95';
const namedAllowlist = `popoulet:${workspaceId},ooeuf:${secondWorkspaceId}`;

if (!isBillingExemptWorkspace(workspaceId, workspaceId)) throw Error('legacy UUID should match');
if (!isBillingExemptWorkspace(workspaceId, namedAllowlist)) throw Error('named UUID should match');
if (!isBillingExemptWorkspace(secondWorkspaceId, namedAllowlist)) throw Error('second named UUID should match');
if (!isBillingExemptWorkspace(workspaceId.toUpperCase(), ` Popoulet : ${workspaceId.toUpperCase()} `)) throw Error('whitespace/case handling');
if (!isBillingExemptWorkspace(workspaceId, ` ${otherWorkspaceId},popoulet:${workspaceId} `)) throw Error('mixed legacy and named entries');
if (isBillingExemptWorkspace(otherWorkspaceId, namedAllowlist)) throw Error('cross-workspace exemption');
for (const invalid of [
  `popoulet:${workspaceId.slice(0, -1)}`,
  `:${workspaceId}`,
  `popoulet:other:${workspaceId}`,
  `popoulet=${workspaceId}`,
  `popoulet ${workspaceId}`,
]) {
  if (isBillingExemptWorkspace(workspaceId, invalid)) throw Error(`invalid entry accepted: ${invalid}`);
}

const previous = process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS;
try {
  process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS = namedAllowlist;
  const exempt = resolveEffectiveSocialEntitlements({ clientId: workspaceId, status: 'expired' });
  if (!exempt.billingExempt || !exempt.entitlements.reports || exempt.entitlements.brandAllowance < 50 || exempt.lifecycle.access !== 'paid') throw Error('expected exempt brands and features');
  const regular = resolveEffectiveSocialEntitlements({ clientId: otherWorkspaceId, status: 'expired' });
  if (regular.billingExempt || regular.lifecycle.access !== 'blocked' || regular.entitlements.brandAllowance !== 0) throw Error('unexpected non-exempt brand entitlement');
} finally {
  if (previous === undefined) delete process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS;
  else process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS = previous;
}
console.log('Exemption checks passed (named and UUID-only allowlist)');
