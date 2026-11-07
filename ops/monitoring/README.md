# HTTPS monitoring worker

Standard-library Python worker for operator-approved public HTTPS homepages. No worker inbound port. Signed: Codex MONITOR. The TAKATAK integration provides a public product page at `/monitoring`, a client dashboard at `/dashboard/web-hosting/monitoring`, and billing through the existing TAKATAK sign-in and Stripe account.

## Behavior

- Check each configured hostname every five minutes; require 2xx at `/`.
- Persist observations and incident state in SQLite across restarts.
- Queue DOWN after three consecutive failures and RECOVERED after two successes.
- Retry owner-email alerts over authenticated STARTTLS SMTP. Missing SMTP leaves notices queued.
- Write current/previous UTC month CSV reports each cycle with observed-check success and sample coverage; retain samples for 400 days.
- Block private/reserved/multicast DNS results; pin the validated address and verify TLS against the original hostname. Never follow redirects or store response bodies.

## Local checks

```bash
python3 -m unittest discover -s ops/monitoring -p 'test_*.py' -v
python3 ops/monitoring/monitor.py validate --config ops/monitoring/sites.json
```

The committed `sites.json` lists public production endpoints checked on 2026-11-07. Each `GET` returns HTTP 200 except `www.takatak.ca`, which is included because its certificate and route are broken. These rows are not paid customer enrollments and have no `domain_asset_id`. A redirect is still a failure. `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MONITOR_FROM` and `MONITOR_TO` are empty in `.env.example`; without them the worker queues notices and the French report says the destination is not configured. No test message was delivered from this repository.

## Deployment

Use an independent host outside the monitored websites' failure domain. Inside `ops/monitoring`, copy `.env.example` to `.env`, set permissions with `chmod 600 .env` and fill sender credentials and the operator's alert inbox privately. STARTTLS on port 587 is supported; implicit TLS on 465 is not. Do not commit credentials, inbox addresses, observations or reports.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose logs --tail=30 monitor
# Export a selected UTC month's report:
docker compose exec monitor python monitor.py report --data /data --month 2026-11
docker compose cp monitor:/data/reports/2026-11.csv ./2026-11.csv
# Stop without deleting history:
docker compose stop monitor
```

Verify controlled incident/recovery email delivery, volume persistence and an independent external watchdog before relying on monitoring. This worker cannot notify you when its own host stops. Never use `down -v` unless deleting observation history is intended. Pin the reviewed base-image digest for production after verifying it.

## Interpretation and limits

A homepage 2xx proves HTTP reachability only, not checkout, authentication, APIs or content correctness. Redirects count as failures; configure the verified canonical hostname. TLS certificates are verified, but advance expiry warnings are not implemented.

Three failed checks confirm an incident in roughly 10–15 minutes plus network delays. Only the first public DNS address is attempted; DNS timing is OS-dependent. Missing periods are unknown. CSV percentages describe sampled checks, not continuous uptime or an SLA. Coverage uses the current interval and whole month; partial-month enrollment appears as partial coverage. Keep configuration/enrollment records separately.

SMTP is at least once: a crash after server acceptance can duplicate a notice despite a stable Message-ID. Monthly CSV creation is automatic. Signed snapshots provide the current/previous month in TAKATAK's client dashboard; automatic customer email-report distribution remains outside this package. Reports and outbox require operator retention management; back up the persistent volume.

## TAKATAK integration

The worker is independently deployed; TAKATAK V1 owns sign-in, workspace permissions, checkout, subscription lifecycle and client reports. No second identity or billing database is created. Existing website pages and services stay in place; navigation, footer, billing card and sitemap additions point to the new product.

1. Deploy the reviewed V1 application and keep `MONITORING_BILLING_ENABLED=false` until the independent worker, support inbox and external watchdog are ready.
2. For each approved DomainAsset, generate a unique 32-byte key privately. In V1 runtime `MONITORING_SYNC_KEYS`, set a JSON mapping from that domain's UUID to its 64-character lowercase hex key. On the worker, add the same key to `.env` under a unique `MONITORING_KEY_...` variable. No key goes in the browser, repository or customer response.
3. In the worker's host-local `sites.json`, add `domain_asset_id` (the domain's UUID) and `sync_key_env` (the variable name) alongside `hostname`. Both fields are required for signed dashboard integration. Set `DASHBOARD_SYNC_ENABLED=true` on the worker, configure SMTP privately and rebuild.
4. Verify the existing shared Stripe webhook `/api/billing/stripe/webhook` receives `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid` and `invoice.payment_failed`. Its existing signature verification routes this product's events to the monitoring handler before Social. Do not replace the existing endpoint or secret.
5. Checkout uses the server-owned CAD 500 cents/month/site price, explicit recurring-consent checkbox and Stripe automatic tax. Verify the Stripe Tax configuration, supported billing address and customer portal cancellation settings in test mode before opening paid enrollment. Existing VIP inclusions must be checked before offering an additional charge.
6. Set `MONITORING_BILLING_ENABLED=true` only after activation verification. An individual domain without a configured key cannot be sold. One concurrent checkout reservation per domain prevents repeated clicks from creating two sessions. A session holds the reservation for 31 minutes and does not create entitlement. Before replacement, the provider must confirm the old session expired: a delayed webhook after completed payment never permits another charge. If a crash left an unrecorded session, support must reconcile it before releasing the reservation.

The worker signs timestamp + raw JSON using its domain-specific HMAC key, sends an authorization request before checking that domain, and stops paid checks on missing authorization, nonpayment, cancellation or expired paid-through date. It sends observations only after authorization. The central endpoint binds the key to the stored domain and derives workspace ownership from that record. The worker never receives an account login or a payment-provider key.

Snapshots, subscription references and checkout reservations live under separate namespaced DomainAsset metadata keys. Optimistic version checks preserve unrelated domain metadata. No schema migration is needed. Reads/exports and billing actions are always workspace filtered; reports require `view_reports`, billing requires `manage_settings`, and the page requires `view_dashboard`. Signup's safe return path carries the client back to monitoring through the existing OTP flow.

Only a current provider-confirmed active subscription with a paid invoice for the exact expected price grants entitlement; the success URL never unlocks service. Subscription events re-read Stripe's current state and guard against out-of-order state changes. Cancellation and past-due states block worker authorization. Cancellation at period end keeps service until the paid-through date. Existing shared customer IDs keep invoices in TAKATAK's invoice center, and the monitoring subscription button opens the existing Stripe customer portal.

The dashboard explicitly shows awaiting-check/stale states and observed-check percentages. It never fabricates uptime. The public page and billing buttons show preparation status while enrollment is disabled. Service does not become operational merely because its page is deployed.

## Validation evidence

13 local behavioral tests passed. Network probes from the restricted development runner were inconclusive; live site availability and email delivery are unverified. Docker is unavailable locally; the dedicated GitHub CI job validates Compose and builds the image. No production deployment is claimed.
