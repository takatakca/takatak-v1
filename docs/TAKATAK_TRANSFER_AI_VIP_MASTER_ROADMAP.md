# TAKATAK TRANSFER AI — VIP Migration Platform / Developer Master Roadmap

**Status:** IMPLEMENTATION RFC + pure-policy foundation only. **NOT live, not deployed, not accepting payments, not migrating client data.**
**Date:** 2026-10-29
**Owner platform:** `takatakca/takatak-v1`; branch `feat/vip-transfer-ai-foundation-20261029`.
**Release:** V1 coordinator reviews/merges and authorizes all live DB, billing, DNS and Coolify actions.
**Brand:** `BRAND.md` — GROUPE TAKATAK, navy/electric blue, English and Canadian French.

> **Customer Hosting Control — owner's final scope:** [Existing-services-only portal specification](TAKATAK_HOSTING_CONTROL_CLIENT_PANEL.md). Reuse exactly the currently offered TAKATAK hosting services, Upmind records and existing Coolify infrastructure. **No separate cPanel/WHM server, new licence, new hosting product or pricing change.** Customers get a TAKATAK-branded dashboard and a secure link to MochaHost's real domain portal while their legacy account remains there. Direct DNS writes, native source-file editor and SSO remain disabled until real scoped integrations are verified. Never request provider passwords in TAKATAK chat or a copied login form.

## 0. Executive product contract

Build a self-service, tenant-safe migration experience for existing MochaHost clients and new clients transferring from GoDaddy, Enom, cPanel/WHM, Plesk, WordPress, custom sites, and other technically supported sources.

Customer promise: **Connect → Inspect → Approve → Pay → Import → Preview → Approve go-live → Launch → Monitor**. Status and AI support are visible at every step. Manual operator fallback is a supported first-class path, not a failure.

### Pricing — explicit owner decision

- **TAKATAK VIP Bundle:** CAD **500.00/year** before applicable taxes. Includes standard TAKATAK dashboard entitlements for the contracted tenant, migration labour/onboarding, hosting under agreed resource limits, and the built-in migration/support AI. Annual renewal is billed via Stripe, with invoices/receipts and payment method lifecycle.
- **Eligible domain:** CAD **20.00/domain/year** before applicable taxes, **distinct recurring line item**. First-year registrar-transfer labour is included in VIP, but the domain charge remains due. For one domain: **CAD 520.00 before applicable taxes**.
- **Paid marketing adapters:** separately billed in existing Stripe add-on system; never silently provisioned, charged, or unlocked by VIP. Ad spend, premium external API accounts, extra AI compute/credits and other pass-through charges remain separately disclosed and consented to.
- **Already-paying MochaHost/legacy clients:** owner-approved legacy mapping, renewal date, prior payments and any proration/credit policy are mandatory before generating a new invoice. Never charge all accounts automatically on import or double-bill.
- **No free domain assumption:** check real registrar/TLD cost and eligibility. If the proposed CAD 20 price cannot be lawfully/operationally offered for a given TLD, do not silently charge a different amount; label ineligible and get an explicit alternate quote/owner decision.
- Billing source of truth is **Stripe verified server-side**; Facturations is the separate draft/invoicing authority where applicable (`docs/TAKATAK_BILLING_FACTURATIONS_FOUNDATION.md`). Do not confuse an internal invoice draft, a checkout redirect, and a verified paid subscription.
- Website public copy currently contains different transfer/renewal prices (`src/components/website/pages/domain-page-content.tsx`), and `src/lib/website/pricing.ts` has its own legacy domain catalog. Implement a **VIP-specific server-side product catalog** and carefully harmonize VIP-facing checkout/copy. Do NOT globally overwrite unrelated public offerings.

## 1. Reality and scope: one-click experience, not universal one-click copying

A registrar move, DNS migration, web-hosting move and email-hosting move are **four distinct operations**. A customer can migrate website hosting without transferring registrar custody. Domain registrar transfer does not deploy or copy a website. Migrating mail may be separate and can affect MX, SPF, DKIM, DMARC, mailbox history and availability.

Provider strategies:
| Source | Detection | Supported path | Important limitations |
|---|---|---|---|
| MochaHost / cPanel | authorized cPanel account or securely uploaded backup | backup, files+SQL+mail inventory, restore to target runtime, preflight | cPanel account backup may need reseller/root/provider cooperation; isolate legacy email |
| GoDaddy | DNS/hosting/registrar discovery (with authorized access) | cPanel or WordPress path when available; domain EPP auth via registrar flow | no assumption that all GoDaddy products expose export APIs |
| Enom | domain registrar only unless other hosting provider confirmed | delegated reseller API/authorized EPP process | Enom is not proof of website-hosting access |
| WordPress / WooCommerce | WP API/plugin with consent | encrypted export of content/media/DB/config, staging import, plugin/theme audit, URL rewrite | PHP runtime, license/paid plugin handling, orders and webhooks need cutover window |
| Plesk | scoped account/backup API | export+restore under operator review | mail and server versions may differ |
| Git/Node/Next.js/static | repository+deployment manifests | vetted build plan, database+asset backup, preview on Coolify | no source-code execution until sandboxed; secrets rebuilt per tenant |
| Shopify/Wix/Squarespace | platform detection | export content/assets, approved rebuild/connector, DNS strategy | NOT a bit-for-bit drop-in copy to Coolify; ecommerce APIs, payments and checkout remain provider-controlled |
| Unknown custom hosting | discovery questionnaire | human-assisted secure SFTP/backup/import | refuse unsafe automation, keep manual runbook |

A domain may be transfer-locked, have an invalid EPP code, be restricted by registry policy, require an approved registrar/reseller arrangement, or be premium-priced. Treat external transfer statuses honestly; never promise near-instant completion.

## 2. Architecture and ownership boundaries

```text
Browser: TAKATAK Marketing / Onboarding / Authenticated Dashboard
  └─ Migration Wizard + Step Tracker + AI Support Chat + Human Support Inbox
           │ HTTPS, server-authenticated + workspace/role checks
           ▼
TAKATAK V1 BFF / API (Next.js, existing Supabase Auth + MasterIdentity)
  ├─ Client / Workspace / Membership / Plan / Entitlements
  ├─ Migration Case / Consent / Approval / Immutable Audit Events
  ├─ Price + Stripe Checkout + verified Webhook / Billing reconciliation
  ├─ Connection metadata + provider capability registry
  ├─ AI Support gateway (retrieval and read-only tools)
  └─ Command dispatcher (strict schemas / server-side authorization)
           │ idempotent jobs, outbox, retries / failure queue
           ▼
Private Migration Worker (isolated Coolify service / queue)
  ├─ cPanel/WordPress/SFTP/source adapters
  ├─ Registrar adapter (only through lawful accredited provider/reseller)
  ├─ Vault / short-lived secrets / credential rotation
  ├─ Quarantined encrypted artifacts (site, database, optional mailbox)
  ├─ Destination generator + runtime-only Coolify env injector
  ├─ Staging/preview URL + QA + backup/rollback + cutover operator
  └─ Job metrics / sanitized logs / alerting
           │
           ├─ Supabase/PostgreSQL (TENANT-SCOPED case metadata; RLS)
           ├─ Object storage (private encrypted per-tenant backups)
           ├─ Stripe (VIP annual + domain annual, existing marketing add-ons separate)
           ├─ Coolify (one isolated app/database/volume/service boundary per client as needed)
           ├─ Domain registrar / DNS (separate ownership and approval)
           └─ Knowledge TakaTak (non-sensitive help knowledge only)
```

Use TAKATAK's canonical client workspace and identity. Never create parallel login, duplicate CRM/customer identity or a second billing authority. The client's website should stay independently exportable; client first-party content remains segregated from TAKATAK-originated leads and agency information. Align with `docs/proposals/CLIENT_INDEPENDENCE_PROPOSAL.md`.

A full production build MUST use durable workers/queue, not a long-running Next.js request/response or a background task in the browser. Coolify hosts the jobs and client sites, but is **not a registrar**.

## 3. Self-service UX — exact screens

1. **Transfer landing:** "Move your website to TAKATAK". Existing customer / new customer; provider logos/selector and business domain field; bilingual benefits, transparent VIP pricing and disclosure.
2. **Identity:** existing TAKATAK sign-in / verified new user account (Supabase Auth); business workspace verification, operator invitation for delegated migration authority.
3. **Discover:** canonicalize domain, detect registrar/DNS/CDN/hosting where feasible, website stack, HTTPS, mail provider, analytics, ecommerce, databases, cron and external dependencies. Return `detected` / `unknown` (never fake certainty).
4. **Scope:** choose website-only / registrar-transfer / email-move, domain count, source platform, backup requirements; warn when source is not automatically portable.
5. **Consent:** click-through migration authority, scope of data transfer, backups/privacy, downtime window, use of third-party sub-processors, explicit registrar transfer consent; collect authorized registrant verification.
6. **Price & Stripe:** server-generated VIP CAD 500 yearly + eligible domains CAD 20 yearly. Applicable taxes and legally required notices computed at checkout. Add-ons appear only in their own Stripe flow.
7. **Secure connect:** OAuth/delegated API if available; otherwise expiring secret form or secure one-time backup upload. Never ask customer to post passwords/EPP codes into AI chat.
8. **Preflight:** show source findings and incompatibilities, DNS/MX inventory, storage estimate, plan capacity, DB/WordPress version, redirects/SEO checklist; operator decision if uncertain.
9. **Transfer progress:** milestones with real timestamps, artifacts, blockers, estimate only if measurable; full retry/escalation.
10. **Preview:** independent preview URL; automated checks + client QA for design, forms, login, payment, email, redirects and content.
11. **Go-live approval:** human confirmation after rollback point has been tested. Clearly separate website DNS switch and registrar transfer request.
12. **Launch+monitor:** limited DNS changes, SSL, uptime, logs, transactions, mail flows, analytics, rollback availability, completion report.
13. **Dashboard:** tenant's full contracted tools, real connection states, recurring subscriptions, invoices, domain renewals, support AI and tickets.

**AI support chat must be accessible on EVERY transfer screen and in dashboard Support.** Offer proactive contextual instructions, but never pop up or initiate destructive actions without consent.

## 4. AI Support — product specification (P0/P1)

Goals: first-response assistance at any hour, natural English and French, per-step migration explanations, account/domain status, deployment checklists, "what is blocking my site?" diagnostics, invoice/renewal education, ticket creation, and clean human escalation.

Data retrieval:
- public TAKATAK help docs; approved sanitized technical runbooks;
- tenant-scoped migration case steps and status;
- redacted job diagnostics, DNS public records, verified billing *status* and tickets;
- permission-filtered existing customer dashboard features;
- **never retrieve another client, raw migration backups, auth codes, private keys, admin API keys or complete `.env` values**.

Tools (read-only by default): `getMigrationStatus`, `getSafePreflight`, `getSupportArticles`, `getBillingStatus`, `getNextRequiredAction`, `createSupportTicket`. Any write action generates an **explicit proposed command** requiring server policy checks, and where needed a fresh, authenticated user/operator approval. A model output is never trusted as a role, payment proof or authorization.

Urgent workflows: "site is down", email failure, payment rejected, high-severity security event, domain about to expire, failed cutover -> create ticket/priority alert, present documented recovery guidance, offer staffed handoff. Never promise human 24/7 coverage unless operationally staffed. Keep support conversations encrypted, minimally retained with published policy, and prevent secret/PII harvesting by prompt injection.

Initial implementation: upgrade `src/app/dashboard/support/page.tsx` (currently a placeholder) and share an embeddable authenticated assistant shell with the onboarding wizard. Keep the existing AI provider bridge instead of creating a second credential store. Consider Tidio for live human handoff only where consent and contractual permissions permit.

## 5. Credential workflow (the critical security design)

The owner requested automatically saving "codes" into the correct `.env`. **Do not write collected credentials or domain auth codes into source-controlled `.env` files, GitHub issues, AI messages, logs or customer-visible exports.** Use:
1. ephemeral credential collection page (server-authenticated, CSRF protected, max payload, no response echo);
2. encrypted dedicated secret manager (or equivalent KMS envelope encryption with audited access);
3. store a vault reference + last4 + status + expiry in the main database, never plaintext;
4. provider-specific scope and expiration; rotate/delete credentials after transfer;
5. worker resolves credential just in time; applies an approved allowlist of **runtime-only** variables to the exact tenant's Coolify application UUID, preferably via locked env/secret manager references;
6. separate build-time from runtime keys; no provider tokens in build args; redact logs, HTTP errors and telemetry;
7. short TTL EPP/auth-code handling exclusively by an authorized registrar adapter. Do not store EPP auth codes as persistent environment variables.
8. source credentials and destination credentials must not be reused. Passwords/imported admin accounts reset at cutover.

All source URLs, backup paths, Git remote addresses, HTTP redirects and archive entries are **untrusted inputs**: DNS rebinding/SSRF controls, allowlisted schemes/IPs and internal network blocks, traversal/symlink and zip-bomb checks, malware scan, CPU/RAM/storage/transfer quotas, sandboxed archive extraction, no arbitrary shell command composition, and no untrusted code running in TAKATAK's core container.

## 6. Data model (proposed migration; NOT applied)

Use new SQL migration after owner approval, with RLS `FORCE ROW LEVEL SECURITY`, no public Data API grants, and service-only access. Suggested entities with `client_id` FK and immutable audit facts:

- `migration_cases`: `id`, `client_id`, `domain`, `source_provider`, `site_type`, `status`, `selected_scope`, `created_by_profile_id`, `assigned_operator_id`, `version`, `created_at`, `updated_at`, `finished_at`.
- `migration_consents`: `case_id`, `actor_id`, `authorization_scope`, `terms_version`, `timestamp`, `evidence_ref`, `revoked_at`.
- `migration_integrations`: `case_id`, `provider`, `vault_secret_ref`, `capabilities`, `validated_at`, `expires_at`, `status`; NEVER `password` or `auth_code`.
- `migration_domain_inventory`: `case_id`, `fqdn`, `registrar`, `dns_provider`, `nameservers`, `mx_snapshot_ref`, `eligible_domain_price`, `registrar_transfer_status`.
- `migration_site_inventory`: `case_id`, `stack`, `database_version`, `software_versions`, `storage_estimate`, `mailbox_count`, `risk_flags`, `checks_json`.
- `migration_jobs`: `id`, `case_id`, `operation`, `idempotency_key`, `status`, `attempts`, `worker_lease_expires_at`, `safe_error_code`, `created_at`, `finished_at`; unique `(case_id, idempotency_key)`.
- `migration_artifacts`: `case_id`, `private_object_key`, `content_hash`, `encryption_key_ref`, `retention_expiry`, `scan_status`, `verified_restore_at`.
- `migration_approvals`: `case_id`, `approval_type`, `actor_id`, `approved_at`, `related_snapshot_hash`, `expires_at`; one-shot version-bound approval to prevent reuse after a site changes.
- `migration_events`: append-only `case_id`, `actor_id`, `action`, `from_status`, `to_status`, `correlation_id`, `sanitized_metadata`, `timestamp`.
- `migration_billing_links`: `case_id`, `client_id`, `stripe_customer_id`, `vip_subscription_id`, `domain_subscription_id`, `legacy_contract_ref`, `payment_verified_at`.
- `support_threads` / `support_messages` / `support_tickets` / `support_escalations`: tenant + principal scope, bounded text, redaction, thread role, retention and external support reference. Keep raw LLM tool proposals out of audit secrets.

Use the existing client, profile, support, billing and job models if they already fulfill a requirement; consolidate naming rather than creating overlapping entities. All reads/writes must check verified actor membership and `client_id` in the same transaction; privileged workers use explicitly scoped capabilities.

## 7. API contract proposal (future, NOT currently mounted)

Version under `/api/v1/migrations`. Authenticated session and tenant membership everywhere except verified Stripe webhook. Enforce `Content-Type`, request bounds, same-origin/CSRF for browser mutations, rate limits, body validation and scoped idempotency keys.

| Method | Route | Purpose | Authorization |
|---|---|---|---|
| POST | `/api/v1/migrations` | Create case with domain and source | client owner/admin |
| GET | `/api/v1/migrations` | List own workspace cases | membership |
| GET | `/api/v1/migrations/{id}` | State, sanitized timeline and next action | membership+case client |
| POST | `/{id}/ownership` | Record verified ownership evidence | client+server challenge |
| POST | `/{id}/scope` | Persist website/mail/registrar scope and signed consent | owner/admin |
| POST | `/{id}/quote` | Return trusted catalog/subscription proposal | owner/admin |
| POST | `/{id}/checkout` | Stripe-hosted yearly subscription checkout | owner/admin; idempotent |
| POST | `/api/stripe/webhooks/vip-migration` | Verify signature and reconcile payment | Stripe only |
| POST | `/{id}/connections` | Issue scoped one-time credential-entry URL/OAuth | owner/admin |
| POST | `/{id}/preflight` | Enqueue read-only inspection | operator / approved worker |
| GET | `/{id}/jobs` | Sanitized job history | membership |
| POST | `/{id}/start` | Queue authorized import after rollback snapshot | operator only |
| POST | `/{id}/approvals/cutover` | Signed, fresh, explicit go-live approval | tenant owner and operator gate |
| POST | `/{id}/cutover` | Execute approved version-bound DNS cutover | operator only |
| POST | `/{id}/rollback` | Safety rollback by explicit authorized operator | operator only |
| POST | `/{id}/registrar-transfer` | Separate domain authorization workflow | registrant + operator |
| POST | `/api/v1/support/chat` | AI chat with tenant-safe, read-only tools | membership |
| POST | `/api/v1/support/tickets` | Human support escalation | membership |

Do not expose Coolify administrator tokens, SSH or vault credentials through any customer route.

## 8. Financial flow and subscription entitlements

1. Resolve existing verified customer+workspace+legacy invoice history; deduplicate by canonical `client_id` and ownership proofs, NOT domain string alone.
2. Server computes `vip_annual = 50000 CAD cents`, `eligible_domain_annual = 2000 CAD cents per eligible domain`. Marketing add-ons never enter this quote.
3. Stripe Customer + Checkout Session in `subscription` mode, annual recurring Price IDs and appropriate tax handling. Stripe price metadata and SKU must be verified against the server catalog; never trust browser sums.
4. Use Stripe API idempotency and persistent case-specific checkout attempt rows. Webhook signature verified on the raw body; event replay ledger. Activate entitlements only on the appropriate verified paid subscription/invoice state, not on success URL.
5. Use Stripe Customer Portal to update cards, download provider-issued receipts, cancel or manage subscriptions as allowed by policy.
6. Dunning, retry, `past_due` grace windows and service suspension must follow signed contracts. Never silently delete a client website, DNS or domain for non-payment.
7. Domain renewal job: reminder at 60/30/7 days (policy-configurable), customer notice and transaction ledger; do not register/renew/transfer until accredited reseller/registrar API and pricing have been verified.
8. Facturations drafts may receive approved billing events but must not create duplicate Stripe charges. Reconciliation ledger is the common join, not double creation.
9. VIP dashboard entitlements resolve by verified SKU, contract and explicit owner overrides; never reuse existing Social plan tier codes as VIP.

## 9. Migration orchestration, no-downtime strategy and rollback

- **Discover** read-only website and mail/DNS dependencies, TLD rules, data size, access rights.
- **Snapshot** encrypted checksum-confirmed source files, database, mail inventory and DNS records; restore a test copy before mutating anything. Record retention and restore point.
- **Build destination** per-client Coolify application with unique UUID, isolated database user/schema, separate storage and tenant-specific environment. WordPress needs a compatible maintained PHP+DB runtime; Node/Next.js requires an audited, reproducible build.
- **Import** data and media with integrity hashes, bounded parallelism and restartable checkpoints. Never sync unfiltered arbitrary server directories.
- **Validate** home/routes/404s/redirects, SSL, canonical/SEO, forms, uploads, credentials, Webhooks, payments, cron, email, scheduled jobs, accessibility/mobile and security headers; define app-specific checks.
- **Go-live** only with signed version-bound owner/operator approval after snapshot, verified preview and clear rollback plan. For WooCommerce/ecommerce, schedule a transactional write-freeze or dual-write/catch-up strategy; don't lose orders or customer data.
- **DNS** modify only the explicitly selected A/AAAA/CNAME records; retain MX, TXT/SPF/DKIM/DMARC, verification and subdomains unless separately approved. Respect low TTL, DNSSEC and proxy/CDN dependencies.
- **Observe** synthetic uptime, SSL, errors, checkout transactions, mail delivery, old/new traffic and evidence-backed monitoring. Preserve prior hosting until the rollback window ends and owner approves closure.
- **Rollback** from tested snapshot/previous DNS target with version and timestamp, operator event, customer notification and reconciled content gap. Completion cannot be declared if validation fails.

## 10. AI safety, support and operations

- User asks "Transfer my website" -> AI proposes **plan** and opens authenticated wizard; not direct credentials or remote shell.
- User asks "Where is my domain?" -> retrieve scoped registrar state with source/timestamp; tell truth about pending.
- User asks "Fix my broken website" -> retrieve redacted health+deployment events, open ticket or queue *read-only* diagnosis.
- Any destructive command (DNS, deployment replacement, deleting old service, registrar EPP submission, restoring production database, billing charge) is forbidden from direct LLM execution. Server permission gate+human approval.
- AI supports FR-CA + EN and tool attribution. Retrieval includes only approved runbooks. Remove private legal/family content from global Knowledge corpus.
- Context-aware triage: "urgent: site offline" creates high-priority ticket/alert; idempotently deduplicated.
- Support metric targets (proposals, **not measured**): instant machine acknowledgment, <2 s status lookup target, >90% case-status accuracy on seeded tests, 0 cross-tenant disclosures, track human response SLA only after staffing is confirmed.
- Operators get queue filters: needs access, manual backup, compatibility failure, EPP wait, checkout issue, human approval, deploy error, postlaunch monitoring.

## 11. Security, privacy, compliance, release gates

- PIPEDA + Québec Law 25 analysis, privacy impact assessment when applicable, signed authority and processing terms, data inventory, purpose/retention policy, breach procedure, export/deletion rights. External vendors/subprocessors and Canadian residency/transfer risks disclosed appropriately.
- Tenant isolation tests: customer A must not read B's job, DNS, invoice, support thread, secret metadata or download URI. Test authenticated and malicious caller paths.
- Never assume control over domain registrant's rights. Contract must permit authorized customer export and lawful transfers-out; do not impose an unreviewed lock-in.
- S3/object-store encrypted backup isolation, signed one-shot links, antivirus/zip-bomb limits, restore verification, disposal schedule.
- DNS update, database restore and billing activation only after independent approvals; no real API calls in CI; mock/fake provider responses must be labeled as test.
- QA: pure policy tests + DB RLS tests + API auth/CSRF/rate limits + mocked adapter contracts + Stripe replay/webhook signature + 2-client isolation + Coolify preview smoke + manual customer acceptance.
- Never auto-run database migration at image startup. Follow `docs/COOLIFY_DIRECT_PRODUCTION.md` and coordinator release lock; first live migration is manually supervised.

## 12. Delivery backlog / milestones and acceptance criteria

### P0 — Architecture and honest contracts (this PR, foundation)
- [x] Verified existing V1 repo, `AGENTS.md`, `WORKLOG.md`, hosting/support structure, existing pricing/copy and billing foundations.
- [x] RFC with separation of migration, registrar, DNS and email work.
- [x] Pure `src/lib/web-migration/vip-transfer-policy.ts` for VIP CAD annual prices and action/status gates.
- [x] Pure regression script `scripts/verify-vip-transfer-policy.ts`; execution result tracked in PR.
- [ ] Coordinator review, resolve feature overlap and agree on VIP product terms/legacy credits/eligible TLD policy.
**Done when:** contracts reviewed, pure tests pass, no deployed capability is misrepresented.

### P1 — Tenant-safe persistent backend
- [ ] New reviewed Prisma/SQL schema + RLS, role checks, migrations/rollback, audit ledger, provider capability registry, blocked-safe status machine.
- [ ] Create/list/read case APIs, ownership/consent flow and idempotent job queue.
- [ ] Security regression and two-tenant DB tests.
**Done when:** authenticated two-client tests pass with real ephemeral PostgreSQL, no credentials stored in DB plaintext.

### P2 — Stripe VIP + domain SKU
- [ ] Stripe annual recurring price IDs, Stripe Tax/jurisdiction, checkout, customer portal, verified event-ledger, duplicate replay/reconciliation and legacy-customer grandfathering.
- [ ] VIP entitlement resolution in all dashboard standard modules; marketing adapters remain separately entitled and separately invoiced.
- [ ] Update public VIP copy and eliminate conflicting figures within that offer.
**Done when:** Stripe test-mode end-to-end renewal, cancellation, retry and 2-client isolation checks pass; no real charge in tests.

### P3 — Secure connectors and backups
- [ ] Vault and short-lived credential intake; OAuth where possible; MochaHost cPanel/WordPress backup MVP; import artifacts/malware scanning, source inventory, restore probes and operator fallback.
- [ ] Provider capability matrix for GoDaddy/Enom/Plesk/custom; explicit unsupported statuses.
**Done when:** consented synthetic site can import via one connector and restore from backup; credentials absent from GitHub/logs/AI.

### P4 — Coolify website migration engine
- [ ] Dedicated worker with job idempotency, concurrency caps and retries; isolated site environment provisioner with env allowlists; preview build and test.
- [ ] Signed go-live approval, DNS diff UI, backup+rollback, smoke tests and monitoring.
**Done when:** verified synthetic source is restored to preview, QA passes, supervised cutover and tested rollback work.

### P5 — AI support and client experience
- [ ] Real dashboard Support module, streaming safe answers from approved knowledge, case/status tools and support tickets.
- [ ] One-screen wizard with progress, FR/EN, notifications/email+SMS (opt-in), live operator handoff, job evidence.
- [ ] Defenses against prompt injection, secret exfiltration, hallucinated job status and cross-tenant access.
**Done when:** clients can ask status/next step and receive backed answers; unsafe requests produce a ticket/approval flow, never a secret.

### P6 — Registrar and DNS extension
- [ ] Contract with accredited registrar/reseller or licensed delegated API; .ca/.com transfer policy/TLD eligibility; EPP one-time flow, expiry, registration renewal.
- [ ] DNS support independent of transfer; guard MX and DNSSEC; domain alerts.
**Done when:** authorized pilot domain transfer is observed from registrar status through completion, with documented rollback limitations.

### P7 — Pilot and commercial launch
- [ ] Pilot ONE consented MochaHost customer first, then 3-5 distinct stacks; gather real preflight+rollback evidence, customer invoice history, and support outcomes.
- [ ] Operator training, privacy/terms approval, technical support staffing, backups, incident playbooks, metrics and capacity/COGS review.
- [ ] Public launch only after P1–P6 acceptance gates and owner approval.
**Done when:** live pilots accepted, no unresolved high severity incidents, support and billing reconciliation operational.

## 13. Recommended work division

| Team | Immediate work |
|---|---|
| Platform/Auth/DB | P1 schema, RLS, membership, migration event and job ledger |
| Billing/Stripe | P2 annual prices, taxes, legacy-credit reconciliation, separate add-ons |
| Infra/DevOps | P3/P4 isolated worker, vault, Coolify provisioner, backups, rollback |
| Migration connectors | MochaHost/cPanel first; WP second; GoDaddy/Enom registrar handoff |
| Frontend | bilingual customer wizard, timeline, pricing transparency, preview QA |
| AI/Support | P5 support agent, safe retrieval/actions, ticket escalation, human handoff |
| QA/Security/Privacy | threat modelling, two-tenant penetration checks, TLD-policy legal review, E2E proof |

**First vertical slice:** authenticated client creates case → approves scope → gets truthful CAD 500+CAD 20 quote → mock Stripe checkout event in tests → uploads encrypted synthetic WordPress backup → operator starts job → worker deploys isolated Coolify preview → health checks → customer approval → operator-governed DNS switch → rollback drill → AI chat gives accurate status throughout.

## 14. Existing work to reuse (do not replace)

- `src/app/dashboard/web-hosting/`, `src/components/web-hosting/`: hosting user experience and data.
- `src/app/dashboard/support/page.tsx`: currently only `ModulePlaceholder`; upgrade it.
- `src/lib/ai-providers/store.ts`, `docs/AI_PROVIDER_KEYS.md`: existing protected provider key storage.
- `src/lib/billing/`, `docs/TAKATAK_BILLING_FACTURATIONS_FOUNDATION.md`: billing provider bridge and invoice authority.
- `prisma/schema.prisma`, `docs/TAKATAK_DASHBOARD_V1_ARCHITECTURE.md`: tenant boundaries.
- `docs/COOLIFY_DIRECT_PRODUCTION.md`: production manual release control.
- `docs/proposals/CLIENT_INDEPENDENCE_PROPOSAL.md`: transfer-out/client-data rights still under review.
- `AGENTS.md` + `WORKLOG.md`: mandatory task and PR handoff protocol.

## 15. Important external references

- ICANN domain Auth-Code policy: https://www.icann.org/resources/pages/auth-2013-05-03-en
- CIRA domain transfer guide: https://www.cira.ca/en/how-to-transfer-domains/
- Coolify runtime env/secret manager guide: https://coolify.io/docs/applications/configuration/environment-variables
- Coolify create application API: https://coolify.io/docs/api/endpoints/applications/create-public-application
- Coolify update env API: https://coolify.io/docs/api/endpoints/applications/update-env-by-application-uuid
- Canadian Privacy Commissioner guide: https://www.priv.gc.ca/en/privacy-topics/information-and-advice-for-individuals/your-privacy-rights/businesses-and-your-personal-information/

**NO LIVE CLAIMS:** this RFC does not assert that an existing registrar reseller API, Coolify API token, vault, backup integration, Stripe VIP product, AI support endpoint, or deployment worker is currently configured or tested.
