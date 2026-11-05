# TAKATAK workspace billing exemption — 2026-11-05

Owner requirement: reuse the existing `SOCIAL_CONNECTION_SETUP_CLIENT_IDS` deployment environment variable as an **all-TAKATAK-subscription exemption allowlist**, not merely an OAuth setup bypass.

## Authority and scope
- Each entry must be a **Client/Workspace UUID**, not Supabase Auth UID. Values are comma-separated, case-insensitive, trimmed; invalid and partial IDs are ignored.
- Exemption is tenant-scoped and read **server-side at runtime**. Other client workspaces managed by the same person are NOT exempt.
- Set/unset by the trusted operator in the deployment runtime; redeploy/restart if the runtime does not refresh environment on its own.
- This is access exemption, not a fake paid subscription and not a Stripe discount or test transaction.
- No changes to existing customer subscriptions or payment history.

## Implemented by this branch
- Common `isBillingExemptWorkspace(clientId)` predicate; existing `isSocialConnectionSetupClient` delegates to it for compatibility.
- Social effective entitlements: exempt workspaces receive the full feature set of the internal/custom Social tier, including reports, publishing, team, analytics, and the four requested connection providers; a finite allocation of X account slots and 50 brands is retained for cost protection.
- Social subscription shell and billing page identify internal exemption, removing the upgrade banner and self-service subscription checkout availability.
- Social connection, provisioning, page, team and server entitlement paths pass workspace context to the common resolver.
- Social Stripe subscription and add-on checkout entry points reject new charges for exempt workspaces.
- Growth Suite feature gates grant exemption by workspace and prevent new paid Growth subscription checkout.
- Website Monitoring uses the same exemption for signed-worker snapshot ingestion and dashboard access; no new monitoring checkout for exempt workspaces, with required per-domain security keys retained.
- No changes to third-party OAuth permission approval, rate limits, content policies, tenant isolation or platform admin roles.

## Uncovered payment domains and costs
- Physical/domain/hosting purchases, externally billed services, Stripe client invoices, AI-credit packs, SMS/voice charges, ad spend and independent hockey membership payments have distinct ordering/settlement paths and may incur third-party costs; **they are not automatically zero-priced** by this branch. Do not assume free external spending or zero out previously issued invoices.
- Existing recurring Stripe/Upmind subscriptions must be inspected and explicitly canceled/credited if appropriate. Simply adding the workspace UUID does **not stop charges already scheduled by the provider**.
- Exemption is for TAKATAK-controlled subscription-feature access, not an authorization to buy unlimited third-party inventory or bypass platform provider approvals.
- Future modules must use the same predicate and declare whether their fees are platform subscription fees or external pass-through charges.

## Acceptance and operations
1. Enter authorized Client UUID(s) in the existing Coolify `SOCIAL_CONNECTION_SETUP_CLIENT_IDS`, server/runtime enabled.
2. Deploy approved build and verify active workspace ID matches exact UUID.
3. Open Social Connections: TikTok personal, Meta Ads, Google Ads, Looker Studio should be startable subject to provider readiness/approved permissions. Billing banners should not appear for the exempt workspace.
4. Verify Social publishing/analytics/team and Growth subscription features for exempt workspace.
5. Switch to an ordinary unpaid workspace under the same login: its feature/billing gate must remain intact.
6. Test checkout: exempt Social/Growth plans cannot initiate payment; normal client checkout unchanged.
7. Review Stripe/Upmind active contracts separately and take explicit account-level action to prevent future actual charges.
8. Run `npm run qa:billing-exemption`, typecheck, lint, CI, production deploy smoke before declaring finished.

Status: implementation submitted for review; no production exemption or live checkout test is claimed.
Signed GPT-6 / TAKATAK V1.
