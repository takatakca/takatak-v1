import { isBillingExemptWorkspace } from '../src/lib/billing/billing-exemption-policy';
if (!isBillingExemptWorkspace('614c6e69-3006-422b-9aa8-00fba5f4ff94', '614c6e69-3006-422b-9aa8-00fba5f4ff94')) throw Error('exemption should match');
if (isBillingExemptWorkspace('614c6e69-3006-422b-9aa8-00fba5f4ff95', '614c6e69-3006-422b-9aa8-00fba5f4ff94')) throw Error('cross-workspace exemption');
console.log('Exemption checks passed');
import { resolveEffectiveSocialEntitlements } from '../src/lib/billing/social/subscription-lifecycle';
const workspaceId = '614c6e69-3006-422b-9aa8-00fba5f4ff94';
const previous = process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS;
process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS = workspaceId;
const exempt = resolveEffectiveSocialEntitlements({ clientId: workspaceId, status: 'expired' });
if (!exempt.billingExempt || !exempt.entitlements.reports || exempt.entitlements.brandAllowance < 50 || exempt.lifecycle.access !== 'paid') throw Error('expected exempt brands and features');
const regular = resolveEffectiveSocialEntitlements({ clientId: '614c6e69-3006-422b-9aa8-00fba5f4ff95', status: 'expired' });
if (regular.billingExempt || regular.lifecycle.access !== 'blocked' || regular.entitlements.brandAllowance !== 0) throw Error('unexpected non-exempt brand entitlement');
process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS = previous;

// A different workspace under the same login must never inherit the exemption.
if (isBillingExemptWorkspace('614c6e69-3006-422b-9aa8-00fba5f4ff95', process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS)) throw Error('cross-workspace leak');
