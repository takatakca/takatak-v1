# TAKATAK V1 — Executable Task Queue

Updated 2026-10-14. **Do not merge, deploy or apply migrations contrary to WORKLOG.md release control.** Order reflects the first tasks an independent agent may perform; an owner/coordinator handles protected production gates. Avoid rewriting existing product features.

| Priority | Task | State / owner | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Review and sequence ADS [PR #176](https://github.com/takatakca/takatak-v1/pull/176) (SDK), [#177](https://github.com/takatakca/takatak-v1/pull/177) (draft editor), [#179](https://github.com/takatakca/takatak-v1/pull/179) (public endpoints) and [#180](https://github.com/takatakca/takatak-v1/pull/180) (CPC budget cap) | **Coordinator merge only**; CI for #176/#177 succeeded; #179/#180 pending | Main includes each reviewed PR; main CI passes; deployment tracked separately |
| P0 | TAKATAK Auth issue [#141](https://github.com/takatakca/takatak-v1/issues/141): real country-aware SMS, signup, recovery and cross-tenant identity | Code work/CI can continue; live provider access required | Staging SMS and server-side membership smoke with synthetic approved identities; sensitive details omitted |
| P0 | Reconcile approved staging migrations | Blocked pending owner-approved backup/apply; release coordinator only | Backup recorded; approved migration history reconciled; staging readiness passes |
| P0 | Production build promotion to `takatak.ca` | Blocked by operator prerequisites, reviewed main and 7 `TAKATAK_PRODUCTION_*` secrets | Same SHA as successful main CI, immutable artifact, correct runtime SHA/header, `/api/health/ready` and rollback evidence |
| P0 | Production website lead capture / phone-only profile schema | Migration/provider gates and secrets | Production migrations approved and applied separately; test lead and phone-only signup accepted without exposing PII |
| P1 | Confirm and update Facturations pinned integration contract SHA after its approved PRs | Facturations owner decision; do not guess SHA | Pinned `FACTURATIONS_REF`, contract CI (including issue → pay) green |
| P1 | Review pending integration PRs #135, #136, #137, #155, #175 and avoid duplicating their functionality | Owner/coordinator decisions | Reviewed conflicts and proper staging migration approvals; no false provider-ready claims |
| P1 | Ads provider rollout: activate legitimate publisher inventory, approved creatives, protected attribution and reports | Some modules exist; real environments/rights missing | Signed serving + measurable impressions + valid event reconciliation on staging |
| P1 | Read public customer data privacy obligations and consent, retention, deletion controls before PR #128 | Blocked: Quebec Law 25 review | Approved retention/consent matrix and verified per-tenant isolation before any CRM prod migration |
| P1 | Verify 1LV/Rentauto tenant-scoped event integrations with dedicated synthetic test data | Staging endpoint and connector secrets required | Idempotent signed events appear in only the entitled tenant |
| P2 | AHMV brand asset update, web integrations, AI Studio keys, QMAPS Google OAuth and back-office provider wiring | Per-product credentials/assets, avoid copying data into the main dashboard | Per-provider contract + independent app entitlement tests + actual connection test |
| HOLD | MIMT runtime/client and VoIP work; Food Hub PR #27 and Coolify PR #104 | Explicit **owner hold** in WORKLOG.md | Owner documents reopening decision before changes |

## Safe work cycle

1. Check `main` SHA, open PR titles, current [WORKLOG.md](../WORKLOG.md) top 40 lines and [AGENTS.md](../AGENTS.md); then review relevant feature docs and the active CI logs.
2. Claim a distinct item in WORKLOG.md on a feature branch, not on `main`.
3. Implement a small end-to-end change. Do not fabricate API results, bypass entitlements, leak secrets, or add unapproved production migrations.
4. Run narrow static/functional tests, `npm run typecheck`, `npm run lint`, `npm run build` and affected CI gates when runtime allows. If not, allow GitHub PR CI to run and record its actual result.
5. Commit/push feature branch, open PR, update [AGENT_HANDOFF.md](AGENT_HANDOFF.md) and WORKLOG.md with exact SHA/PR and next action.
6. Merge/deploy only with currently applicable owner/coordinator authorization. Confirm the deployed SHA, not just the pipeline creation.
7. Repeat the next **non-overlapping, unblocked** item.

Original backlog is [DEV-TODO.md](DEV-TODO.md), [WORKLOG.md](../WORKLOG.md), open GitHub issues and knowledgeAI `docs/11-DEV-BACKLOG.md` on its documented branch. This queue is a concise live index, not a replacement.


## 2026-10-15 execution delta
- Coordinator: review and sequence green PR #176–#183, noting the Coolify #181 proposal is not approved/merged; do not skip production change control.
- Developer: watch #184 1LV streaming-body hardening and #185 CUBAFOOD master contract CI; repair failures, hand off passing PRs.
- After CUBAFOOD contract owner approval: implement dedicated server receiver with durable nonce/replay ledger, idempotency by event_id, explicit tenant-client mapping, entitlement, and verified user identity-link consent; run staging cross-tenant tests before any activation.
- Production promotion remains restricted by WORKLOG.md and requires actually verified runtime SHA, not branch CI.

## Additional immediate follow-up — 2026-10-15

- Review [PR #186](https://github.com/takatakca/takatak-v1/pull/186) shared workspace JSON reader; verify targeted CI, TypeScript, lint and application-flow tests on its exact head.
- #184 completed full green CI. #185 targeted CUBAFOOD contract QA passed while full CI remained running at last inspection. Coordinate reviews without unauthorized merge.
- Hourly agent reactivation is configured via ChatGPT task, but progress and publication still require connector privileges and the repository's owner authorization.


## 2026-10-15 newest actionable follow-up

1. **CI:** inspect SHA `3d993f2b00e07335c7f9c375902ad33f56a123c0` and latest branch head for [PR #187](https://github.com/takatakca/takatak-v1/pull/187), fix any test/typecheck/build failures, and update the branch WORKLOG. It contains Auth JSON streaming, MIME and invited-password CSRF fixes and a regression test in `npm run test:auth`.
2. **Review:** owner/coordinator to merge accepted green PRs one at a time in compatible order; full CI is green on #176–#186 but merge/deploy remains withheld. Revalidate main after every merge and reconcile common CI/WORKLOG edits.
3. **Auth P0 [#141](https://github.com/takatakca/takatak-v1/issues/141):** real staging Supabase/Twilio Canadian phone OTP proof, strict identity mapping and two-tenant isolation remain required. Do not treat synthetic CI as a real SMS receipt.
4. **CUBAFOOD [#161](https://github.com/takatakca/takatak-v1/issues/161):** #185 defines only the offline contract; do not enable API without verified tenant mapping, entitlements, replay storage, and user-consented identity linking.
5. **Go live:** await current owner-approved host, staging/production migrations and secrets; verify real `/api/health/ready` and deployed SHA.

## Staging next audit (2026-10-15)
Compare Supabase and Prisma migration histories for the phone-only profile email and lead attachments in audit-only mode, then obtain backup and coordinator/owner authorization before applying or resolving any migration. Do not replay SQL based only on differing history names. Verify real Supabase Twilio Phone Auth SMS separately under issue #141.

### Staging exact next gate
The phone-only email nullable column was verified present in staging. `lead_attachments` was verified absent. Coordinator: first audit/reconcile the already-applied phone-only SQL under `docs/staging-migration-reconciliation.md`, then obtain backup and owner-approved staging apply for the missing attachments migration and any other pending migrations. Production approval is separate.
