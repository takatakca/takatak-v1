# TAKATAK V1 — Security Checklist

- **Auth:** Supabase cookie sessions; proxy + layout + guard layers; production foundation mode denied by default (explicit override documented unsafe). ☐ Verify on real project.
- **Roles:** owner/admin/manager/staff/viewer from the persistent Profile ONLY (Phase 15A); owner default removed; owner creation solely via audited `bootstrap:owner` script; profiles sync least-privileged (viewer, no memberships).
- **Tenant scoping:** ✅ Enforced server-side in all module data layers (Phase 15A; `qa:tenant-isolation` 16/16). Prisma scoping primary, RLS secondary. ☐ Live Supabase E2E on staging.
- **API routes:** health minimal by default; test/status admin-only (401/403/503); webhook disabled-by-default, size-bounded (413), content-type checked (415), body never logged, permanently `trusted:false` until official signature docs.
- **RLS:** 001–007 apply cleanly; read-only membership policies; the two `using(true)` policies are deliberate global READS (service catalog, report templates).
- **Secrets:** env-only, presence-checked, never logged; redaction utilities in `src/lib/security/redact.ts`; CI secret scan.
- **Headers:** nosniff, Referrer-Policy, X-Frame-Options SAMEORIGIN, Permissions-Policy, COOP. **CSP deferred deliberately** — plan: introduce report-only CSP on staging, verify hydration/auth, then enforce. HSTS at platform level after HTTPS domain confirmed.
- **Redirects:** `sanitizeNextPath` used in auth callback (blocks external/protocol-relative/backslash/scheme paths).
- **Logs:** safe-error + redaction; audit metadata renders note-only; no payloads/IPs/user agents in UI.
- **Files/storage:** none exists yet (future phase). **Dependencies:** 2 moderate advisories (transitive postcss pinned inside next@16.2.10; upstream-owned; no force fix). **Backups/monitoring/incident response:** production prerequisites — not yet configured.
- **Rate limiting:** none implemented; production must use a durable platform/provider solution (Vercel WAF/rate limits or an edge provider) — in-memory fakes were deliberately not added.
