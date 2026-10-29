# TAKATAK HOSTING CONTROL — per-client control panel specification

**2026-10-29 — addendum to** `docs/TAKATAK_TRANSFER_AI_VIP_MASTER_ROADMAP.md` (draft PR #229, issue #228)

**Owner requirement:** every VIP client can control their own website/backend with a cPanel-like interface, on TAKATAK-managed hosting, without access to another client or the host OS.

**Decision:** default to TAKATAK-branded **Hosting Control inside the existing dashboard** with server-mediated Coolify integration. Offer **actual cPanel/WHM only as an optional separate licensed hosting engine**, not inside existing Coolify host. Do not conflate the two products.

## 1. Non-negotiable platform boundaries

| Layer | Owns | Client access |
|---|---|---|
| TAKATAK `takatak-v1` | Auth, CRM client/brand, verified VIP entitlement, scoped panel UI, support, audit, billing | Authenticated workspace interface only |
| Hosting-control API/BFF | Tenant/site resolver, RBAC, policy and rate limits; safe actions | Indirect via Next.js routes; no Coolify token |
| Hosting worker | Job execution, stored approvals, logs redaction and resource quotas | Never directly exposed |
| Coolify control plane | Private deploy API, projects, isolated applications and databases | Platform operators only by default |
| Client website workload | Site-specific container, DB user, storage, app runtime secrets, backup | Via allowed scoped panel actions; CMS users can also use their own CMS login |
| Licensed WHM (optional) | Separate physical/virtual machine with clean supported OS, cPanel licenses, packages and users | Own cPanel account ONLY, never WHM root |
| External email service | Actual mailboxes, migration, MX/DKIM/SPF/DMARC | Separate contracted product or supported cPanel engine |

The full host root account, Docker socket, arbitrary terminal, Coolify default-team admin, backups of other sites and API tokens must never be accessible to customers.

## 2. Hosting modes

**Mode A: Coolify + TAKATAK Hosting Control (default, recommended)**

- One TAKATAK **client workspace** → N sites linked through immutable `hosting_resource_bindings` to Coolify `team_id`, `project_uuid`, `app_uuid`, `db_resource_uuid`, `server_id`, `primary_domain`. All identifiers are created/resolved on the server.
- Prefer distinct Coolify teams for privileged development operators. For end customers, **do not grant native Coolify Admin/Owner** simply to allow file edits or deploys: those roles can manage team credentials, services and terminals. Coolify Member is largely read-only. The TAKATAK portal gives more granular permissions by calling vetted server-only endpoints on their behalf.
- Coolify is the deployment platform. It is **not cPanel and not a full mailbox server**. File management, database browsing and WordPress account administration require separate scoped adapters and/or services; do not label unavailable features as functional.
- Provision an application/container and DB with scoped credentials and resource limits; no shared DB admin user, wildcard persistent volumes or shared `.env`. For stronger untrusted-code isolation, use distinct VMs/nodes/hosts per trust tier, not just multi-tenant containers on one privileged Docker daemon.
- WordPress customers additionally get standard `wp-admin` to edit their site; the hosting panel manages backups, SSL, DNS requests, deployed site info, limited files, traffic, etc.

**Mode B: cPanel/WHM on separate host (optional true cPanel)**

- Provision a new compatible dedicated VM/server, **fresh clean OS** with its own public static IP, approved DNS and a suitable cPanel license. cPanel officially requires clean install; do not install over Coolify (or use Coolify as a cPanel surrogate).
- Configure WHM master under TAKATAK; create a per-customer cPanel user/account/package using WHM API's `createacct`, with tenant mapping and server-authoritative quotas/feature list.
- Clients access **only their cPanel account** using cPanel's supported authentication/SSO methods; do not give WHM root, unrestricted reseller, shell or another account's token. Domain transfers and Stripe billing still happen in TAKATAK.
- Manage licensing cost per cPanel account; include/exclude in VIP per contract and margin validation. Native cPanel makes sense for legacy PHP/email/reseller needs, not a forced dependency for Node/Next.js Docker workloads.
- Verify cPanel security, installation and API docs when implementing, and keep their API key on a separate backend vault.

Official docs: https://coolify.io/docs/core/team/roles-and-permissions ; https://coolify.io/docs/api/overview ; https://coolify.io/docs/api/permissions ; https://docs.cpanel.net/installation-guide/install/ ; https://docs.cpanel.net/whm/account-functions/create-a-new-account/ ; https://api.docs.cpanel.net/specifications/whm.openapi/account-creation .

## 3. Required TAKATAK client panel features

| Feature | Proposed client interaction | Backend implementation / guard |
|---|---|---|
| Overview | website URL, SSL, status, uptime, current release, usage | verified Coolify app UUID and hosted monitoring |
| Website files | list/edit *approved app directories* | safe file service, allowlisted path under tenant root, no symlinks/path traversal, no `.env`, no host volumes, backups first |
| Databases | inspect/export scoped database | separate app DB user, enforced table allowlists, read-only default, bounded queries; production writes gated and backed up |
| Deployments | see history, launch preview, request production deploy | CI-green immutable digest/commit pin, job with idempotency, snapshot, typed approval for production |
| Backups | create, download approved export, request restore | tenant-specific encrypted object storage, scoped time-limited URL, tested restore |
| SSL | certificate status and safe renew action | Coolify/Traefik or cPanel-backed status; no arbitrary proxy admin |
| Domains/DNS | view inventory, request record change | zone owner proof, exact diff, protect MX/TXT/DNSSEC, operator approval |
| Environment | request new runtime secret, see redacted key names | vault capture, approved runtime allowlist, no secret readback to browser or chat |
| Resource controls | view quota, usage, downtime, plan | quotas for disk, RAM, CPU, database, egress and backups (owner-defined capacity) |
| WordPress | open CMS admin under own customer credentials | separate WP login/OAuth; no fabricated universal SSO |
| Email accounts | manage mailbox only if supported service purchased | dedicated mail provider adapter or real cPanel backend; not native Coolify functionality |
| AI support | what broke? backup ETA? deploy reason? domain status? | tenant-filtered safe tools; status and ticket only, no root or secret disclosure |

**VIP unlimited dashboard entitlement does not mean unlimited physical resources.** Publish explicit quotas, fair-use, maximum websites and overflow pricing. Keep marketing adapters separately billed as planned.

## 4. Client permissions

**TAKATAK user roles:** owner, manager, developer, viewer. **Internal:** platform_operator, with independent privileged credentials. A separate AI pseudo-role is always denied infrastructure mutations.

| Operation | Owner | Manager | Developer | Viewer | Operator |
|---|---|---|---|---|---|
| View own status and sanitized logs | yes | yes | yes | yes | yes |
| Limited website files/DB export/preview | yes | yes | yes | read-only* | yes |
| Create backup | yes | yes | yes | no | yes |
| Production deploy | yes, with fresh approval and rollback point | no | no | no | with fresh approval |
| Production restore, DNS change, secret replace | request only | request only | no | no | only after recorded approval |
| Read plaintext secrets, root shell, host admin | **no** | **no** | **no** | **no** | not through client panel |

*Viewer sees only sanitized metadata/website monitoring, not sensitive source-code or database contents.

Use `src/lib/web-migration/hosting-control-policy.ts` for the initial **pure** contract. Enforcement in production must use trusted session membership, tenant-scoped resource IDs, active VIP entitlement, restore confirmation and immutable approval evidence loaded from server data — never browser-supplied `role` or `approved: true`.

## 5. Provisioning algorithm (when implemented)

1. Verified VIP signup/legacy credit entitlement → obtain canonical TAKATAK `clientId`; workspace permissions and primary site ownership verified.
2. Choose `hosting_engine` by supported workload: Coolify default, cPanel licensed optional.
3. Reserve unique resource binding with a stable idempotency key and create an auditable `hosting_provisioning_job`.
4. Compute quotas and names from validated catalog only (no client-supplied Coolify `serverUUID`, Docker command, WHM package or arbitrary base path).
5. Operator-held API service account provisions tenant project/site/DB and runtime-only vault refs; require build provenance and isolated container permissions.
6. Record Coolify/team/project/app/database mapping or WHM account identifiers, with no passwords in main DB.
7. Verify app health, ownership link, backend panel visibility, tenant isolation and a backup restore point; only mark active after observed evidence.
8. Show client's own Hosting Control panel and notify them; in exceptional cases open manual operator ticket.

## 6. Proposed APIs (do not mount before P1 DB/RLS)

- `GET /api/v1/hosting/sites`: only tenant resources, sanitized status and limits.
- `GET /api/v1/hosting/sites/{siteId}`: verified app metadata.
- `GET /api/v1/hosting/sites/{siteId}/logs`: bounded redacted logs, not raw Coolify log streams.
- `POST /api/v1/hosting/sites/{siteId}/backups`: safe tenant-scoped job.
- `GET /api/v1/hosting/sites/{siteId}/backups`: names, sizes, verified state; downloads via short-lived token.
- `POST /api/v1/hosting/sites/{siteId}/deployments/preview`: allowlisted verified source ref.
- `POST /api/v1/hosting/sites/{siteId}/deployments/production`: signed owner approval + backup + immutable release.
- `POST /api/v1/hosting/sites/{siteId}/domains/changes`: create approval request, not immediate DNS mutation.
- `POST /api/v1/hosting/sites/{siteId}/secrets/replace`: one-time tokenized vault form, never browser-exposed secret reads.
- `POST /api/v1/hosting/sites/{siteId}/support/tickets`: client can always reach support even if subscription requires attention.

All mutations: HTTP origin/CSRF, strict schema, scoped idempotency, rate limit, audit event, outcome verification. Use worker-specific per-team API tokens with minimal privileges; no client-supplied Coolify endpoints, URLs or app UUIDs.

## 7. Operational and security QA

- Two tenants on same physical host: account A cannot see files, logs, DB, secrets, environments, backup export or operations of B.
- Negative authorization test across all roles and endpoints, including reusing siteId across tenants, expired/deleted membership and stale approvals.
- Protect against malicious WordPress plugins/Node packages: no privileged Docker, host Docker socket, unrestricted resource terminal, cross-tenant mount, outbound internal service access, or unauthorized SSH.
- Safe browse/edit: canonical-path containment checks, symlink bans, deny dotfiles/config/secret paths, bytes/content-type limits, audit and backup-first.
- DB operations use separately limited DB credentials, query timeout, non-admin connections and encrypted exports.
- Direct native Coolify team/member sharing requires a separate dedicated security review, and MUST NOT be the default customer access model.
- Billing edge cases: cancel, expired VIP, annual domain renewal unpaid, legacy prepaid contracts — never delete production site or domain automatically; provide safe contracted transitions and backup export options.
- Capacity and cost: forecast cPanel licenses, number of app containers, PHP/Node memory, PostgreSQL/MariaDB, backups and mailboxes against existing VPS; allocate more isolated nodes as customers increase.

## 8. Incremental delivery

**H0 (this PR):** architecture and pure RBAC contract/test only; no live access granted.

**H1:** server-side `hosting_resource_bindings` migration/RLS, verified list/read API, customer dashboard website cards, two-tenant tests.

**H2:** backup status/create/download + sanitized logs, monitoring, WordPress admin handoff, support AI reads.

**H3:** approved file manager / safe database browsing and isolated preview deployment via restricted worker; security penetration tests.

**H4:** customer-approved production deploy with rollback, scoped secret-replace form, DNS approval workflow, support escalation.

**H5:** optional licensed WHM integration, cPanel account provisioning/SSO/quotas and clearly separated email services; price and infrastructure review.

**Go-live acceptance:** tenant A cannot trigger ANY service/control for B; no user can get root/host terminal through panel; a complete site is deployed, backed up, restored and controlled from the dashboard with audited approvals. Operator-only backdoors and raw credentials are excluded.
