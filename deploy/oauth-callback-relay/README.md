# OAuth callback relay (production first-hop protection)

Meta always redirects with `?code=&state=` (or error fields) on a **GET**.
Most hosts (including Vercel) write that full URL into HTTP access logs
**before** application code runs.

## Architecture

1. Register the **relay** HTTPS URL as `META_OAUTH_REDIRECT_URI` (Meta app + env).
2. Relay receives Meta's GET (query stays off the Next.js origin).
3. Relay POSTs JSON `{ code, state, error, ... }` to
   `https://<app>/api/social/callback/facebook` with **no query string**.
4. Next.js processes the body and redirects the browser.

Local/dev without a relay still uses:

- `logging.incomingRequests.ignore` for `/api/social/callback/` (Next.js **dev** access logger only)
- Ingress GET → httpOnly encrypted handoff cookie → `/handoff` with empty query

## Cloudflare Worker

See `cloudflare-worker.js`. Bind:

- `ORIGIN_CALLBACK_URL` = `https://<app>/api/social/callback/facebook`
- `RELAY_SHARED_SECRET` = optional

Never log `request.url`, query strings, or bodies in the Worker.
