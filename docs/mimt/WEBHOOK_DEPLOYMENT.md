# MIMT → TAKATAK signed webhook deployment

This receiver is independent of TAKATAK Auth/OIDC. It does not make TAKATAK
an identity provider and does not turn MIMT's proposed `mimt-web` client ID
into a registered OpenID Connect client.

## Two server-side locations for one generated secret

Generate a cryptographically random 32-byte secret represented as **64 lowercase
hex characters** on your own machine, e.g.:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not paste the value into GitHub source, a PR, an issue, a chat message, a
screenshot, or a NEXT_PUBLIC_/VITE_ variable. Configure the identical value:

1. **MIMT**: Coolify → Projects → MIMT → production → MIMT API →
   Environment Variables → `TAKATAK_WEBHOOK_SECRET` (runtime, secret).
   Its outbound destination is `TAKATAK_WEBHOOK_URL=https://takatak.ca/api/integrations/mimt/events`
   **after this route has passed CI, been merged, deployed and tested**.
2. **TAKATAK**: MochaHost cPanel → File Manager → the production **release
   wrapper** directory → edit the existing server-managed `.env` file and add
   `MIMT_WEBHOOK_SECRET=<same generated code>` on its own line.

In the verified production promotion architecture, GitHub Actions' secret
`TAKATAK_PRODUCTION_APP_ROOT` identifies the absolute **release wrapper**;
its value is not published in code. The directory typically looks like:

```
<production wrapper>/
  .env                       # persistent source of production config
  current -> releases/<sha>/app
  releases/<sha>/app/.env     # active release copy
  releases/<sha>/app/server.js
```

The deployment script **copies** `<wrapper>/.env` into the new release at
`<wrapper>/releases/<sha>/app/.env`. Merely editing `<wrapper>/.env` does
**not** update an already-running release. To enable before the next promotion,
back up and update the existing `current/.env` as well, then restart the
application **once** through cPanel's Node.js application screen. Otherwise,
the next *approved* production promotion copies the persistent file into the
new release. Do not overwrite or delete any other lines. Do not create a
new `.env` that replaces the current database/auth secrets.

If you cannot find the production wrapper or file in File Manager:
- Confirm the **Application Root** of `takatak.ca` in cPanel's Node.js application.
- Enable **Show Hidden Files (dotfiles)** in File Manager settings.
- Check the parent directory of the `current` symlink for the persistent
  `.env`, not GitHub's `apps/takatak` folder.
- If the release-wrapper layout is not present, stop: the actual live hosting
  path differs from the documented release system. Confirm the live startup
  command, server.js and environment source before editing anything.

A GitHub Actions secret by itself is *not* automatically injected into the
running MochaHost Passenger application. The configured release pipeline
preserves server-side `.env` instead of injecting that variable.

## Route / security / acceptance

- Endpoint: `POST https://takatak.ca/api/integrations/mimt/events`
- Required header: `X-MIMT-Signature: t=<unix-seconds>,v1=<hmac-sha256-hex>`
- Signing string: `<timestamp>.<exact raw JSON body>`, HMAC key is the
  **literal 64-character code**, not hex-decoded bytes
- Five-minute signature window, constant-time HMAC comparison, event-ID
  idempotency and maximum 32 KiB request body
- Only accepts known MIMT event types; stores a database receipt with minimal
  opaque references. Never saves raw phone numbers or message/call content.
- `202` means **persisted receipt**, *not* a CRM merge, entitlement activation,
  consumer consent, or proof of TAKATAK Auth federation.
- Missing secret → `503`; wrong signature → `401`; missing database →
  `503`. MIMT's outbox retries non-2xx responses.
- Requires the existing `source_synchronization_events` table in TAKATAK's
  production database; no new migration is introduced.

Before enabling MIMT production outbound events, merge & deploy the receiver,
verify signed staging requests using test event identifiers and check duplicate,
wrong signature, replay, cross-tenant and 503 behavior. Real phone/SMS content
must never be forwarded into the agency data store.

## Verification

```bash
npx tsx scripts/mimt-webhook-tests.ts
```

Review TAKATAK Auth issue #141 separately. The OIDC issuer
`https://takatak.ca` and `mimt-web` are still proposed until a real OIDC
discovery document, token endpoint, JWKS, registered client and PKCE exchange
are verified.
