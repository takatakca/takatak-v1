# TAKATAK HOSTING CONTROL — existing services only (owner correction 2026-10-29)

**Status: implementation plan + first verified-provider handoff UI on draft PR #229. Not deployed.**

This supersedes the prior proposal for a separate cPanel/WHM server. **Do not launch another hosting product, install cPanel/WHM, purchase hosting licences, create a replacement hosting stack, or modify current hosting plans.** TAKATAK must use its existing website/hosting plans, existing Upmind domain/hosting integration, existing Coolify platform, current Auth/workspace model, and current pricing as authorized by the owner.

## Owner's intended customer experience

The customer logs into TAKATAK's existing dashboard, opens the **Web & Domain** workspace, sees only their websites/domains, and can do the following when the existing service supports it:

1. **My website** — access website administration, edit/upload site files within *that website only*, view safe status, request backup/restore. While still hosted on MochaHost, its existing cPanel/File Manager remains the place to do this. Once site hosting is on TAKATAK/Coolify, add a separate safe site-scoped file adapter/worker; never pretend Coolify itself is a cPanel clone.
2. **My domain** — use TAKATAK's domain/hosting record page, and an **existing-provider portal** for the customer's real provider account. For MochaHost, a TAKATAK-branded *handoff page* opens the actual official provider client area in a new tab: https://clients.mochahost.com/. Client enters their credentials **at MochaHost, not TAKATAK**.
3. **DNS settings** — display only existing scoped records and source labels; **no edit button until actual zone authority + provider API access + scoped approval are verified**. Domain registrar, authoritative DNS, and web host may be different. Do not change MX, SPF, DKIM, DMARC, DNSSEC, nameservers or other records just because a website is being moved.
4. **AI support** — help customers find the correct panel, guide through domain login, explain transfer status, show only scoped site data, create tickets; never request MochaHost credentials or EPP codes in chat, impersonate MochaHost, or fabricate working APIs.
5. **Paying VIP clients** continue on CAD 500/y + tax with eligible domain CAD 20/y + tax as defined in the transfer roadmap; marketing adapters remain separate. This addendum adds **no new price, quota, feature tier, or charge**.

## What was actually found in GitHub

- Existing web workspace: `src/app/dashboard/web-hosting`, `src/components/web-hosting`, `src/lib/web-hosting`.
- The domain page (`src/app/dashboard/web-hosting/domains/page.tsx`) already syncs Upmind domains to real scoped rows. Legacy MochaHost domains **will not automatically appear** until verified/linked; do not fabricate rows.
- `getDomainAssetsData` and `getDnsRecordsData` use `resolveDataScope`, checking the current authenticated client's workspace. Demo rows are marked `internal_demo` and hidden in the provider portal.
- `src/app/dashboard/web-hosting/pages/page.tsx` and `src/app/dashboard/files/page.tsx` are currently placeholders — not working source-file editors.
- Quick Actions in `src/components/web-hosting/hosting-accounts-overview.tsx` had **cPanel Login: Not connected** and **File Manager: Not connected**. The first is now replaced with **Domain Provider Portal**; File Manager remains inactive until a safe real integration exists.
- Upmind admin page documents that hosting provisioning, DNS editing and SSL management are not yet active. Do not present tracking records as connected control.
- Coolify is a privileged platform control plane. Native administrative team access and direct SSH/Docker/socket access **do not belong in end-customer accounts**.

## Current implementation in PR #229

- `src/lib/web-hosting/domain-provider-handoff.ts`: exact, constant allowlist for MochaHost official client area. No user-supplied URL, login form, credential capture, reverse-proxy or unsupported SSO.
- `src/app/dashboard/web-hosting/domain-portal/page.tsx`: authenticated dashboard route; existing tenant-scoped domain records; provider handoff; explanation of source DNS and file-management availability; no action pretending to write DNS.
- `src/components/web-hosting/web-domain-shell.tsx`: Web & Domain navigation link.
- `src/components/web-hosting/hosting-accounts-overview.tsx`: link to the new page from quick actions.
- `src/lib/web-migration/hosting-control-policy.ts`: pure access-contract safeguards, now explicitly scoped to **existing TAKATAK services only**.
- `scripts/verify-hosting-control-policy.ts` and `scripts/verify-domain-provider-handoff.ts`: negative security checks, no live providers/side effects.

## Next work: deliver file editing on current hosting, not arbitrary host access

Do **not** build an unrestricted file manager against the Contabo host. Implement a verified adapter for each existing TAKATAK-supported workload:

- Obtain the authenticated `client_id` and authorized site id using server-side membership, `hosting_service` and actual Coolify binding. Never accept client-supplied app/server UUID or home directory without cross-checking ownership.
- For each website, isolate content directory/volume and database, prevent symlink/path traversal and writes outside the allowlisted site's content root.
- Allow an authenticated **site owner/developer** to upload approved files (type/size/extension and malware checks, immutable backup first); preserve old versions and audit who changed what. Show file edit only where content structure is supported (for example WordPress `wp-admin`, site-controlled asset folder, or Git workflow for Next.js).
- Use secure signed upload/download URLs or a dedicated scoped worker; NEVER give the customer Coolify global token, server SSH, raw Docker API, arbitrary terminal, `.env` or another tenant's storage.
- Provide server-side file-size limits, path canonicalization, rate limits, CSRF protection, retention/rollback and support ticket on error. Reject operations when site mapping is not proven.
- For Git-managed builds, edits must follow the repository branch/PR/build pipeline rather than directly mutating immutable release container files. Do not overwrite app release code using a web editor.

## Future verified provider-linking work

A user may authorize an integration if an official provider API/SSO exists and terms allow it. Until then use **branded handoff → official login**. No cloned MochaHost password page, password forwarding, proxy login or false single sign-on. A landing page that redirects to the real provider is sufficient and safer.

Data joining contract: `client_id + verified DomainAsset/HostingService + providerAccountRef (if authorized)`; providers and data owners remain distinct. If data missing, explain that legacy linking is pending rather than showing someone else's domains.

**Acceptance gates**
1. Live portal route never leaks a domain from another workspace; a domain is shown only after existing verified association.
2. Exact allowlisted HTTPS provider login URL; no passwords, external URL injection or app-auth crossover.
3. Legacy user can click to official MochaHost account and use their own existing credentials.
4. Source file upload/edit cannot be enabled before real site-scoped adapter, backups and isolation tests.
5. No extra hosting engine or product/pricing introduced, and no live DNS or servers changed.
6. Owner/coordinator reviews CI and separately authorizes any production change.
