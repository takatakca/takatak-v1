# Billing

Subscription access for social connections lives in:

- `src/lib/billing/client-subscription-access-policy.ts` — pure policy (testable)
- `src/lib/billing/client-subscription-access.ts` — server assert used by OAuth start

## Social connection authorization

Allowed when:

1. `ClientSubscription.status` is `active` or `trial`, or
2. A **trusted server-side** development bypass is enabled **and** the runtime
   is not production (`NODE_ENV !== "production"` and `VERCEL_ENV !== "production"`).

Trusted bypass sources (never from the browser):

- Non-production application runtime (default for local/manual Meta OAuth testing)
- `ClientSubscription.developmentBypass` in the database
- Process env `SOCIAL_CONNECTION_DEV_BYPASS=true`

Force real subscription checks even outside production:

- `SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true`

Not authorization inputs:

- Preview helper query (`?preview=subscribed`, etc.)
- Request body / headers claiming bypass, paid plan, or subscription status

The Real / New user / Subscribed / Onboarding helper remains UI-only. Preview is
preserved across Manage connections / platform navigation so it does not snap
back to Real. Facebook OAuth-start outside production uses the server runtime
bypass and does not invent fake paid subscription status.

Verify policy:

```bash
npx tsx scripts/verify-social-connection-access-policy.ts
```
