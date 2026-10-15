# TAKATAK V1 — Agent Handoff (read immediately)

Last update: **2026-10-14**. Read [AGENTS.md](../AGENTS.md), first 40 lines of [WORKLOG.md](../WORKLOG.md) and open PR titles **before coding**. Follow the current owner release-control rule. This document captures one agent's observed state, not a perpetual claim about GitHub or production.

## Repository and immutable baseline

- Repo: https://github.com/takatakca/takatak-v1
- Main branch and last confirmed main SHA: `main` at `dcd454e42e95f08c407c53ab1af73ee2b36e0e4f`.
- Last completed developer features: [#176](https://github.com/takatakca/takatak-v1/pull/176) and [#177](https://github.com/takatakca/takatak-v1/pull/177), **implemented on feature branches and passing CI, NOT merged**.
- Latest observed PR CIs: #176 run [38608344700](https://github.com/takatakca/takatak-v1/actions/runs/38608344700) = success; #177 run [38608979371](https://github.com/takatakca/takatak-v1/actions/runs/38608979371) = success.
- Additional independent API-hardening PRs: [#179](https://github.com/takatakca/takatak-v1/pull/179) adds bounded public ADS payloads, and [#180](https://github.com/takatakca/takatak-v1/pull/180) caps atomic CPC charges. Both open with CI pending at handoff. Do not duplicate those patches.
- Current handoff/continuity documentation branch: `docs/agent-continuity-gates-20261014` → [PR #178](https://github.com/takatakca/takatak-v1/pull/178). Branch updates are recorded in its GitHub PR and branch head; **do not confuse feature-branch commits with `main`.**

## Last completed task and current task

- Last feature task completed: ADS SDK hardening and campaign draft UI (PRs #176, #177; awaiting coordinated merge).
- Current task: finish CI verification of [PR #178](https://github.com/takatakca/takatak-v1/pull/178), plus #179 and #180; fix any failures on their respective branches and hand green PRs to release coordinator.
- Next independent technical work after this PR: inspect green/failed CI and open PR conflicts before taking another *unclaimed* issue from [TASK_QUEUE.md](TASK_QUEUE.md). Do not duplicate #175, #173 or any open PR.

## Files modified on this branch

- `docs/PROJECT_STATUS.md` — verified implementation/live status and current open work.
- `docs/TASK_QUEUE.md` — prioritized backlog, permission/owner gates and acceptance evidence.
- `docs/AGENT_HANDOFF.md` — this exact resume point and verification evidence.
- `docs/DEPLOYMENT.md` — production/staging runbook index and release proof.
- `docs/DECISIONS.md` — preserved owner decisions and platform invariants.
- `scripts/verify-agent-handoff.cjs` — implemented continuity guard.
- `package.json` and `.github/workflows/ci.yml` — implemented QA wiring.
- `AGENTS.md` — implemented resume-pointer update.
- `WORKLOG.md` — implemented session claim / handoff log.

GitHub history is authoritative for the exact final commit. At this file's most recent pre-update review, the branch head was `b881541a13c1d11ee0dce656a4fe6f0dbab7f4af` (`docs/DECISIONS.md`); subsequent changes to this file and CI necessarily advance branch HEAD.

## Verification performed / not performed

- GitHub repository, default branch, main SHA, PR titles and owner restrictions read via GitHub connector. PR #178 continuity guard step passed in GitHub CI; full run still in progress at last check.
- Both earlier feature PRs had **completed successful GitHub CI** as of 2026-10-14.
- Local terminal `git ls-remote` was attempted but failed: environment could not resolve `github.com`; all repository changes used the authorized GitHub connector.
- PRs #178, #179 and #180 are open; all require green branch CI. The new `Agent continuation documentation safeguards` step on #178 has already succeeded. Run `npm run qa:handoff` through GitHub CI and record its green/red outcome; do not assume success before the workflow finishes.
- A live production deployment, production SMS test, applied migration, and operational secrets validation **were NOT executed**.

## Known blockers / access needed (never include values)

1. Owner/coordinator lock from `WORKLOG.md`: this agent cannot merge into `main` or dispatch staging/production workflows.
2. Production `TAKATAK_PRODUCTION_*` GitHub Environment secrets and an approved existing Passenger release wrapper must be confirmed by authorized operator.
3. Staging backup + authorized migration reconciliation, then separate production migration approval; automation skips are not a success.
4. Live Supabase Phone Auth/Twilio provider and suitable synthetic test number/permissions are needed to close #141.
5. Provider APIs, Facturations integration and other external services need actual credentialed tests, separate privacy approval for #128.
6. MIMT, Food Hub and Coolify remain owner-paused according to WORKLOG.md.

## Exact next action for the next agent

1. Read AGENTS.md and top 40 WORKLOG.md lines; fetch `main` HEAD and list open PRs, especially #176, #177 and this handoff PR. Compare with SHA above.
2. Open PR #178, #179 and #180 CI; if red, inspect failed GitHub Actions job steps and fix only this branch. If green, hand PR to release coordinator for reviewed merge **without dispatching production**.
3. Update this file and WORKLOG entry with exact final branch SHA, commands/CI link, and accurate status. Verify `docs/PROJECT_STATUS.md` and queue reflect newer decisions.
4. Select the next unclaimed and authorized development item. Do not apply migrations, call provider write APIs, deploy or force-push as a workaround.

## Restart model

This file makes manual or orchestrator-driven resumption deterministic. **A prompt does not keep an agent running after a session terminates**. External orchestration requires a separately configured, authorized runner; none was created or assumed here.


## 2026-10-15 resumption — overrides stale CI entries above
Verified main SHA: dcd454e42e95f08c407c53ab1af73ee2b36e0e4f; no PR #176–#185 merged at inspection.
Full GitHub CI succeeded on feature PRs #176–#183 (their current heads). New PR #184 (1LV master JSON streaming cap) has a passing targeted QA step, with full CI pending. New PR #185 (CUBAFOOD event contract/HMAC) is pending full CI.
Related work branches: fix/master-api-bounded-json-20261015 (last pushed bb3ddca882c94aa3734680a9c0bdfe86409099de) and feat/cubafood-master-contract-20261015 (last pushed 592f3048d170f6d596041f4480102f925c10874a).
Files changed in PR #184: src/lib/integrations/master-api/http.ts, scripts/master-api-request-body-tests.ts, .github/workflows/ci.yml, WORKLOG.md. Files changed in #185: src/lib/integrations/cubafood/contract.ts, scripts/cubafood-master-contract-tests.ts, docs/CUBAFOOD_MASTER_API_CONTRACT.md, package.json, .github/workflows/ci.yml, WORKLOG.md.
Verification: GitHub Actions runs https://github.com/takatakca/takatak-v1/actions/runs/38774944793 and https://github.com/takatakca/takatak-v1/actions/runs/38775405051; no local full-build claim, no production deploy, no staging SQL, no secret changes.
Open PR #181 proposes direct Coolify and passed CI, but the owner release lock and hosting decision in WORKLOG.md were not lifted. Do not treat it as live.
Next exact action: check #184/#185 latest SHA-specific CI; patch failed tests on their own branches, then coordinate the ordered PR merges and authorized release. The CUBAFOOD live receiver is NOT implemented: require tenant mapping, product entitlement, persisted nonce+idempotency and verified identity linking before it is enabled. Continue other unclaimed items when provider/secrets block this.
No autonomous orchestrator has been configured; a future runner must read this handoff and verify latest GitHub state.

## 2026-10-15 later update — continuous resume configuration

- New [PR #186](https://github.com/takatakca/takatak-v1/pull/186): shared authenticated dashboard JSON reader now enforces a streaming byte ceiling, retains CSRF/origin checks, and adds CI regression test. Branch last pushed SHA `e566972c761949cece05e5858e7e239e2a20512a`; full CI was running at this update.
- [PR #184](https://github.com/takatakca/takatak-v1/pull/184) completed full green CI in run [38774944793](https://github.com/takatakca/takatak-v1/actions/runs/38774944793). [PR #185](https://github.com/takatakca/takatak-v1/pull/185) passed targeted CUBAFOOD contract safeguards; full CI continued.
- A ChatGPT scheduled resume task named **TAKATAK V1 — Reprise GitHub** was created and enabled on 2026-10-15 for hourly execution. It will request a new authorized review/development run, subject to connected tool permissions. This is periodic, not a continuous unattended process, and cannot bypass the coordinator release gate.
- Earlier notes saying no orchestrator existed were true at their timestamp but are now superseded by the enabled hourly task. Its first actual successful run is not yet verified.
- Exact next action: inspect the latest SHA-specific CI for #185, #186 and the handoff PR #178, correct any failed step, update SHA/CI evidence, and hand off green PRs. Do not assume any deployed revision on takatak.ca.


## 2026-10-15 15:04 America/Toronto — latest canonical resume checkpoint

**Last task completed:** security corrections committed and pushed as [PR #187](https://github.com/takatakca/takatak-v1/pull/187), branch `fix/auth-origin-json-bounds-20261015`, head `3d993f2b00e07335c7f9c375902ad33f56a123c0`. Its full CI was **in progress**, not claimed green. PRs #176–#186 had green full CI on their latest heads.

**Current task:** inspect and resolve PR #187 CI (run `38791407973`), then hand off coordinator-reviewed sequential merges. If green, select the next unclaimed, unblocked code task from TASK_QUEUE and original DEV-TODO; do not duplicate currently open PRs.

**Files changed on PR #187:** `src/lib/auth/trusted-origin.ts`, `src/lib/auth/auth-json.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/complete-invitation/route.ts`, `scripts/auth-json-origin-tests.ts`, `package.json`, `WORKLOG.md`. Auth assertions are included in the existing `npm run test:auth` run; no new migrations.

**Verification evidence:** confirmed repository and open PR list through GitHub, inspected AGENTS.md, top WORKLOG.md and prior handoff; current main SHA `dcd454e42e95f08c407c53ab1af73ee2b36e0e4f`. Green CI on #176–#186 including [#184](https://github.com/takatakca/takatak-v1/actions/runs/38774944793), [#185](https://github.com/takatakca/takatak-v1/actions/runs/38775479258), [#186](https://github.com/takatakca/takatak-v1/actions/runs/38776174356). New #187 CI: https://github.com/takatakca/takatak-v1/actions/runs/38791407973. No local full Next.js build, production SMS, live deployment or production secrets verification performed.

**Known blockers:** WORKLOG.md coordinator-only merge/deploy lock; unresolved production hosting decision (new Coolify PR #181 unmerged), 7 environment deployment credentials for documented MochaHost path, staging database backup/migration approval, actual Supabase/Twilio tests and app/provider entitlements. Keep all credential values out of git.

**Deployment status:** `main` unchanged as above, staging/release workflow runs observed skipped, live site revision not verified. A green feature PR is not proof of public release.

**Exact next action:** fetch PR #187 head and run result, repair its own branch if red; update WORKLOG and this handoff; then execute next **authorized** task. Preserve the existing hourly scheduled continuation task; it cannot independently lift coordinator approval or access requirements.

This documentation branch is PR #178. This handoff commit itself advances its branch head; confirm new SHA via GitHub after the update.

## 2026-10-15 staging check (read-only)
TAKATAK STAGING reports ACTIVE_HEALTHY. The Supabase migration ledger contains the phone-only profile email change. The separate Prisma history shows 87 completed entries, but neither the exact phone-only migration name nor the website attachment migration name appeared in a targeted read-only lookup. This difference needs reconciliation before any approved database release; do not infer that SQL is missing. No staging write or SMS delivery test was performed. The Twilio provider remains unverified. Next action: check PR #187 full CI and use the existing migration audit-only workflow under release-coordinator control.

### 2026-10-15 staging schema confirmation
A further read-only SQL inspection confirmed `public.profiles.email` is nullable `text` (matching the approved phone-only schema target despite a differing history name). `to_regclass('public.lead_attachments')` returned NULL: the attachments table does not exist in staging. Do not reapply phone-only SQL; the coordinator must use the documented audit/reconcile history-alias path. Attachment migration remains pending owner approval, database backup, and authorized staging apply. No SQL write occurred.
