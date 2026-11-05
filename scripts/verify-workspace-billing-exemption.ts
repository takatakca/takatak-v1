import { isBillingExemptWorkspace } from '../src/lib/billing/billing-exemption-policy';
if (!isBillingExemptWorkspace('614c6e69-3006-422b-9aa8-00fba5f4ff94', '614c6e69-3006-422b-9aa8-00fba5f4ff94')) throw Error('exemption should match');
if (isBillingExemptWorkspace('614c6e69-3006-422b-9aa8-00fba5f4ff95', '614c6e69-3006-422b-9aa8-00fba5f4ff94')) throw Error('cross-workspace exemption');
console.log('Exemption checks passed');
