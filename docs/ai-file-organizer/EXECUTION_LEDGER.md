# TAKATAK AI File Organizer — Execution Ledger
Updated: 2026-11-15. Status: IN DEVELOPMENT, NOT LIVE.

## Mission and non-negotiables
Integrate a USD 20/month AI-first file organizer as an add-on inside existing TAKATAK-V1 Files/Studio/Agents/KnowledgeAI/Settings/Billing. AI classifies, proposes destinations and files automatically only within consented scopes; users may approve/change/reject or use existing manual controls. No duplicate dashboard, AI provider, storage stack, payment processor or agent builder. Existing Ollama Cloud and Studio worker first. Do not expose secrets, cross-tenant files or unapproved personal data.

## Verified references
- Existing repo: takatakca/takatak-v1; current draft PR: https://github.com/takatakca/takatak-v1/pull/304; branch feat/ai-file-organizer-ux-spec-20261115.
- Existing Ollama Cloud docs: docs/OLLAMA_CLOUD.md; provider catalog: src/lib/ai-providers/catalog.ts; Studio agent/worker: src/lib/studio/agent-policy.ts, src/lib/studio/worker.ts.
- knowledgeAI/deploy/ai-studio/docker-compose.yml has Open WebUI Ollama API disabled; it is not proof of running local Ollama.
- knowledgeAI/private-knowledge/README.md explicitly says private service NOT DEPLOYED.
- First policy code: src/lib/ai-file-organizer/approval-policy.ts; tests written: scripts/ai-file-organizer-policy-tests.ts; tests not yet executed.
- Earlier specification: docs/ai-file-organizer/IMPLEMENTATION_UX_SPEC.md.
- Follow repository AGENTS.md, docs/AGENT_HANDOFF.md, docs/TASK_QUEUE.md, docs/DECISIONS.md, docs/DEPLOYMENT.md, WORKLOG.md and coordination issue foodhubca#105 before writes. Respect release gate.

## Work queue (complete in dependency order)
- [ ] P0: Read latest main, coordination issue #105, AGENTS.md, handoff, task queue, decisions, deployment docs, open PRs. Check branch drift, conflicts, ownership. Record findings here and in WORKLOG.
- [ ] P0: Inventory real Files routes, studio asset persistence, KnowledgeAI, agent tools, auth/tenant rules, provider routing, billing entitlements, job infrastructure, hosting upload paths, Prisma schema and tests. Produce path-by-path integration map with evidence.
- [ ] P1: Execute policy tests and typecheck in actual checkout/CI; fix errors. Avoid untested claims.
- [ ] P1: Implement workspace-scoped organizer settings and persisted policy, default off, consent and provider-processing disclosures; enforce server-side.
- [ ] P1: Implement idempotent ingestion/index records preserving originals, audit trail, reversible classification and bounded queue.
- [ ] P1: Reuse Ollama provider routing for bounded structured classification with safe schema validation, tenant scope, data minimization, cost ceilings, retry/fallback and no silent provider charges.
- [ ] P1: Implement suggested filing + approval/change/reject and manual override in existing Files UI; notifications and activity.
- [ ] P1: Integrate Studio outputs and authorized agent tools; do not silently move hosting files or publish media.
- [ ] P1: Implement existing-billing USD 20/month add-on product entitlement, webhook lifecycle, failed payments, cancellation, quotas and bypass rules; avoid double billing with Studio credits.
- [ ] P2: Full unit/integration/security/E2E tests including two-tenant isolation, denied consent, duplicates, large media, provider outage, budget exhaustion, rollback.
- [ ] P2: CI green, reviewed PR, staged rollout, deployment through approved production release process, verify authenticated client journey, billing, AI operation, audit, recovery and monitor. Only then mark LIVE.

## Current progress
- DONE: GitHub repo inventory and Ollama/KnowledgeAI/Studio code reconnaissance; requirements and pricing documented; policy module and 12 test cases committed on draft PR.
- BLOCKED/UNVERIFIED: full repository audit, actual tests, persistent storage, AI execution, UI, billing, release access, runtime deployment.
- Next exact step: inspect repo coordination and dashboard/storage/billing files; write integration map and then implement the first testable vertical slice. Do not merge or deploy unverified changes.

## Agent handoff protocol
At every run: read this file, latest GitHub main SHA, AGENTS.md and current issue #105; avoid conflicting agent work. Make one small tested increment. Update this ledger and WORKLOG with concrete paths, commit SHA, test evidence, remaining blockers, next action. Keep user-facing update to 1-3 lines: Done / Next / Live status. Never claim 100% until verified production end-to-end. Never enable live charges or migrate private data without required approval.

## Increment 2026-11-15 — coordination + concrete code map
- Read latest AGENTS.md, docs/AGENT_HANDOFF.md, docs/TASK_QUEUE.md, docs/DECISIONS.md and docs/DEPLOYMENT.md; confirmed main has concurrent Studio/Meta changes and production release is gated by exact-head CI + verified Coolify SHA. Claimed work on public coordination issue foodhubca#105 (comment 6905879027).
- Confirmed actual code locations by GitHub search: `src/app/api/studio/library/route.ts` and `src/lib/studio/library-policy.ts` (existing SavedAiOutput library); `src/lib/studio/output-link.ts` (transactional output link); `src/lib/studio/worker.ts` (idempotent job/credit behavior); `src/lib/billing/client-subscription-access.ts`, `src/lib/billing/social/entitlement-gates.ts`, `src/lib/billing/growth/entitlements.ts` (existing billing patterns); `src/lib/web-migration/hosting-control-policy.ts` and `src/app/dashboard/web-hosting/domain-portal/page.tsx` (hosting controls).
- **Important boundary:** Studio library currently represents SavedAiOutput *text drafts*, not proof of a generic photo/video/document file store. Avoid assuming that a file can be physically moved there. Hosting file controls must not be modified without verified provider API support.
- Next: read the above route and entitlement implementations; design an organizer metadata overlay keyed by authorized existing asset IDs, rather than moving originals. Execute tests and check actual CI. No runtime deployment claimed.

## Increment 2026-11-15 — main-reconciled Studio preview guard (not live)
- Main f1cd567f85b7ae1c7be16ed9e37407072eb134a8 was **68 commits ahead** of branch 79aaffaf; moved pending work onto fresh `feat/ai-file-organizer-studio-guard-20261115` from current main. Preserve original historical branch/PR #304.
- Integration map: `src/app/api/studio/library/route.ts` gates `create_content`; `src/lib/studio/library-policy.ts` reads `saved_ai_outputs` filtered by clientId and Studio metadata source, **text only**. New `studio-existing-records.ts` reads only `clientId, origin, status`, filters existing `savedAiOutput` by ID, tenant, AI origin, visible states and `STUDIO_OUTPUT_SOURCE`; it never reads draft content. `src/lib/billing/growth/entitlements.ts` has pilot allow-all semantics, so it is **NOT** used to authorize the organizer; instead the new resolver checks the existing `growthSubscription` row for exact `ai_file_organizer` plan key and a current paid Stripe period, or the existing trusted workspace exemption. `TAKATAK_AI_FILE_ORGANIZER_ENABLED` defaults OFF and no checkout/webhook or price is added.
- `studio-approval.ts` connects the existing deterministic approval-policy to permission, subscription, source and resolved destination ownership callbacks. Missing real destination adapter denies; even an `auto_approved` preview is **never a write**. No new route, migration, charge, provider call, bulk file scan or file move.
- Test evidence: isolated global TypeScript compiler strict typecheck for pure policy/preview modules passed; compiled synthetic integration suite ran **26/26**. Existing pure policy suite has 12 fixtures, now registered together in `qa:ai-file-organizer` in the normal CI pipeline. **Full repo CI pending; no exact-head green claim.** Local environment has no authenticated GitHub checkout or installed project dependencies.
- Next: verify exact-head GitHub CI, fix any type/lint failures; map real destinations and persisted workspace settings, client permission at API boundary; only then build persistent suggestion/approval/audit with replay, rollback and an explicitly reviewed USD20 Stripe product. All production flags/charges OFF.

### Final handoff / latest source
- Initial implementation commit: `0e2e6073cca7280bccefd6b5ef11e0b4c2246dd9` on main-reconciled branch; draft PR: https://github.com/takatakca/takatak-v1/pull/314.
- Isolated repeat strict TS compilation and synthetic test execution: **PASS, 26/26**. Full GitHub CI run 43797413069 started, still IN PROGRESS at this checkpoint; do not call it green.
- Current job owner PAUSED via foodhubca issue #105; next: verify PR exact-head full CI, review real destination adapter + persisted workspace policy. Release state **NOT LIVE**.

## 2026-11-16 main reconciliation
- Original guarded PR #314 exact-head CI 43797593692: **SUCCESS**. That PR's earlier base subsequently diverged by 14 commits and reported mergeable=false. This new branch replays its own 11 file changes without overwriting main-only work, built from main 059b36521. No prior PR merge or live activation assumed.
- Code remains preview-only and fail-closed; no DB schema delta, payment activation, provider work or physical file moving.
- Immediate next: exact-head CI on successor PR, coordinator review, gated merge then independently verify served SHA. Build actual workspace settings and approved suggestions as a separate schema-gated increment.

## 2026-11-16 — main merged preview and policy QA successor
- PR #316 exact-head CI 43803365992 **SUCCESS**, squash merged `f7bc6d322f03f7055743e0c4eee76000c2356346`. Feature remains OFF, no verified running user workflow.
- Replayed only new policy/schema files from stacked PR #317 onto fresh main, plus `scripts/ai-file-organizer-db-tests.ts`: ephemeral DB checks two-tenant destination scoping, default OFF, optimistic revision, RLS. CI invokes this after disposable DB startup.
- New policy migration is **NOT APPLIED** to TAKATAK STAGING or PRODUCTION; do not enable flags or live charges. Next: exact CI, migration review, audited consent UI, separate filing approvals.

## 2026-11-16 — PR #318 merged and safe Studio consent UI
- Confirmed PR #318 exact-head `01ee2aee7160fd0726725a9a07da1589ac2f8d21`, CI **43804686427 SUCCESS**, base main `f7bc6d32`, mergeable clean; reviewed authorized `manage_settings` API, `readJsonBody` same-origin/write limits, per-client Studio project count, optimistic revision/audit, RLS migration. Merged PR #318 into main commit **`cd834ccf1d6caef978213e089ff0cd4c08744255`**. Migration is **not applied** to staging/production; runtime flag still OFF, no provider/billing/storage activation.
- Follow-on branch `feat/ai-file-organizer-studio-settings-20261116`: new `/dashboard/studio/organizer` manager-only page, linked from Studio; bilingual FR/EN component uses only existing `GET/PUT /api/ai-file-organizer/settings` and authorized current-workspace Studio projects, strict consent checkboxes, manual project selection, high-confidence threshold, revision bound update and 409 conflict recovery. UI cannot assert clientId, grant entitlement, select unknown destination, enable `auto`, move files or start AI processing. If entitlement is locked or schema unavailable, display an honest non-actionable state.
- Added isolated UI payload policy (`src/lib/ai-file-organizer/settings-ui.ts`) and synthetic tests. Actual suggestion review `Approuver/Modifier/Refuser` deliberately not presented as live until there is a persisted, versioned suggestion queue with audit/rollback; no private storage bucket exists in last operator inventory. Source CI pending; no production live claim.
- Next: review UI exact-head CI; separate suggestion proposal persistence and review API with source/destination revalidation, approved migration/staging backup and cross-tenant tests, then owned private file storage. USD20/month entitlement lifecycle and Coolify served SHA remain pending.
