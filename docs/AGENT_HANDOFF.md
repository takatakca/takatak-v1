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


## 2026-10-15 23:53–00:00 America/Toronto — latest resumption, authoritative over historical snapshots

Repository `takatakca/takatak-v1`; observed **main HEAD `b59ca994a73c5ed0e19e3d0f8d0540feddeb5e24`**, one new commit beyond earlier `dcd454...`. The release coordinator merged Coolify Docker/CI PR #181 into main. Auto production deploy and staging workflows observed skipped; this merge does **not** prove the production site is deployed or healthy. WORKLOG's coordinator-only release control was still present and is not lifted by this agent.

**Last tasks completed and pushed:** PR [#187](https://github.com/takatakca/takatak-v1/pull/187) now also refuses CSRF Origin spoofing using Host/X-Forwarded-Host. Merged the new main **into its feature branch only**, preserving the Coolify WORKLOG entry. Branch HEAD `4f34f264d528cfceb0d4c597487a283f9c72be98`, no conflicts; full CI run [38848123656](https://github.com/takatakca/takatak-v1/actions/runs/38848123656) was in progress. Previous exact head `3d993f...` passed full CI before new origin hardening. Modified `src/lib/auth/trusted-origin.ts`, `scripts/auth-json-origin-tests.ts`, `WORKLOG.md`, merged new main.

**New independent functionality:** PR [#188](https://github.com/takatakca/takatak-v1/pull/188) fixes `/api/health/ready` returning 200 when DB or Supabase was `not_configured`, by making both required states strictly `ok`; otherwise 503. Branch `fix/strict-runtime-readiness-20261015`, last pushed `f9c6f3cdcdd584f2cb08af04af1175cac09daa1f`. Changed `src/lib/ops/runtime-readiness.ts`, `src/app/api/health/ready/route.ts`, `scripts/verify-runtime-readiness.ts`, `.github/workflows/ci.yml`, `docs/COOLIFY_DIRECT_PRODUCTION.md`, and `WORKLOG.md`. Nine pure readiness combinations and Docker/route invariants are executed in full GitHub CI run [38848366850](https://github.com/takatakca/takatak-v1/actions/runs/38848366850), pending at this handoff.

**Checks run/evidence:** GitHub branch HEADs/commits, open PR list, AGENTS.md, first WORKLOG entries, feature source, Coolify Dockerfile/workflow, CI runs and deployment workflow status inspected using connected GitHub API. Prior #187 original CI passed. Full tests/build for #187 updated and #188 are still to be confirmed at latest SHAs. Read-only health checks of `https://takatak.ca/api/health` and `/ready` were attempted via web and local requests but were inaccessible/DNS resolution failed; no runtime SHA/health was verified. No DB write, schema change, provider activation, secret use, migration apply, main push or deploy.

**Access/blocks:** production host and credentials/approved environment, coordinator-only release lock, unapproved staging backup+remaining migrations, real Twilio Phone Auth E2E, tenant isolation on a live staging server. The Supabase staging profile email nullable text field was confirmed earlier but `lead_attachments` missing; no new staging changes this session.

**Exact next action:** check latest commits' GitHub Actions for PR #187, #188 and this documentation PR #178. If red, inspect exact failed jobs and fix only the relevant PR branch. If green, give coordinator PRs for reviewed sequential merges, re-run main CI, do separately approved migration/release steps and verify runtime SHA. No automatic merge or deploy from this session. Hourly ChatGPT task already exists; do not create a duplicate.



## 2026-10-15 final verification delta (newer than preceding sections)

- PR #187 **full GitHub CI succeeded** for HEAD `4f34f264d528cfceb0d4c597487a283f9c72be98`: [run 38848123656](https://github.com/takatakca/takatak-v1/actions/runs/38848123656). It remains open/unmerged; the changes are not proven in production.
- PR #188 HEAD `f9c6f3cdcdd584f2cb08af04af1175cac09daa1f`: `Strict runtime health readiness safeguards` test step succeeded; full [run 38848366850](https://github.com/takatakca/takatak-v1/actions/runs/38848366850) continued at last check. Do not mark entire CI green until completion.
- This documentation branch was reconciled with Coolify main via merge HEAD `aa8e31ba165960fdac3e9afa8cecffa3fcf838ab`; each later handoff edit advances its SHA. Review the latest CI after this note.
- A progress report was posted to existing Auth issue #141 with accurate work and outstanding provider tests (no passwords, access tokens or customer PII).
- No production deploy, schema modification, provider SMS or live runtime health proof occurred. Most recent deployment workflows were skipped; live takatak.ca health could not be checked due external-access limitations.
- Next action: watch PR #188 current-head full CI and this documentation PR #178; repair any failures on their own branches; then hand reviewed green PRs to the designated main/release coordinator and only publish after allowed go-live gates.


## 2026-10-16 00:21 America/New_York — CI and release gate verification

- `main` remains `b59ca994a73c5ed0e19e3d0f8d0540feddeb5e24` (merged Coolify foundation #181; live deployment **not verified**).
- PR #187 at `4f34f264d528cfceb0d4c597487a283f9c72be98`: full CI run [38848123656](https://github.com/takatakca/takatak-v1/actions/runs/38848123656) completed **success**.
- PR #188 at `f9c6f3cdcdd584f2cb08af04af1175cac09daa1f`: full CI run [38848366850](https://github.com/takatakca/takatak-v1/actions/runs/38848366850) completed **success**.
- PR #178 at `79c0059235299d4df6ab984cf634502ee79e0443`: full CI run [38848823266](https://github.com/takatakca/takatak-v1/actions/runs/38848823266) completed **success** before this proposed handoff edit.
- Existing unmerged branch `feat/r2f-opportunity-contract-20261015` at `e6b16bfa99affde383362af9e2bcb96ac1b6c0c4` contains an offline Phase 2 R2F state/projection contract and deterministic tests, but has no PR and no commit-specific CI run. Its proposed `.github/workflows/ci.yml` wiring was **blocked by the connected tool's safety checks**, so no claim of completed code verification or PR creation. Do not duplicate; resume that branch if write access is authorized.
- The latest main staging, migration and Coolify deployment workflow runs were **skipped**; no production SHA, SMS delivery, Supabase Auth live E2E, database apply or release verified.
- Owner/coordinator WORKLOG lock remains in force. Supabase staging `profiles.email` nullable text is already present; `lead_attachments` absent; Prisma/Supabase migration histories differ. Require audit, backup and explicit approval before any apply.


## 2026-10-16 05:44 America/Toronto — current verified resumption (supersedes older snapshots)

**Repository/main:** `takatakca/takatak-v1`, current `main=c53ed4529e03b15a0241f5b96e4ed37d3f50f56e`. Main includes owner/coordinator merges #181 (Coolify Docker), #188 (strict runtime readiness), #185 (offline CUBAFOOD contract), #177 (ADS drafts), #175 (R2NETTE receiver), #155 (AI keys), #136 (QMAPS event bridge), and #189 (admin import fix/staging migration approval). `main` GitHub CI [38858131646](https://github.com/takatakca/takatak-v1/actions/runs/38858131646) completed success. The visible Coolify production workflows were **skipped**, not evidence of release.

**Last engineering task:** continued existing `feat/r2f-opportunity-contract-20261015` rather than rebuilding. R2F #160 Phase 2 adds ten typed internal states, allowed transition matrix, minimal four-field public projection, synthetic QA and an offline design document. [PR #193](https://github.com/takatakca/takatak-v1/pull/193) open, current code head at last inspection `3a457fda6092701fba3ce3f1910b04ad9811c920`. Merge of newer main into R2F branch preserved other agents' files. `scripts/r2f-opportunity-contract-tests.ts` is now wired into `.github/workflows/ci.yml` via `qa:r2f-opportunity-contract`. [CI 38882991101](https://github.com/takatakca/takatak-v1/actions/runs/38882991101) was **running**, not yet claimed successful at this checkpoint. No live R2F route, FLEXS/QMAPS activation or schema change was made.

**Documentation task:** reconciled [PR #178](https://github.com/takatakca/takatak-v1/pull/178) against new main with two-parent commit `2cbecd96486ff019b154b21da492b909839aaa9c`, preserving all newly merged GitHub workflows/dependencies, five continuity files, `AGENTS.md`, `scripts/verify-agent-handoff.cjs`, `scripts/verify-agent-handoff.test.cjs`, and current WORKLOG. Added `qa:handoff` and the corresponding CI guard to current main's package/workflow on the documentation branch. The subsequent documentation edits advance this head. [CI 38883195355](https://github.com/takatakca/takatak-v1/actions/runs/38883195355) was queued at initial check.

**Other CI:** PR #187 `4f34f264d528cfceb0d4c597487a283f9c72be98` full [CI 38848123656](https://github.com/takatakca/takatak-v1/actions/runs/38848123656) passed but is still open, not deployed. #188 [CI 38848366850](https://github.com/takatakca/takatak-v1/actions/runs/38848366850) passed and the PR was merged to main. Do not confuse branch tests with runtime acceptance.

**Files changed this session:** R2F branch: `src/lib/integrations/r2f/opportunity-contract.ts` (preserved existing), `scripts/r2f-opportunity-contract-tests.ts` (preserved existing), `docs/R2F_OPPORTUNITY_CONTRACT.md` (preserved existing), `package.json`, `.github/workflows/ci.yml`, `WORKLOG.md`. Continuity PR: five `docs/*` files listed in AGENTS plus `AGENTS.md`, `WORKLOG.md`, `package.json`, `.github/workflows/ci.yml` and two verification scripts (preserved and rebased, not rewritten from scratch).

**Commands and verification:** GitHub API read of branches, PRs, commit history, docs and Actions; source inspection and JSON parsing for modified package; targeted CI launched automatically by PR pushes. Public `https://takatak.ca/api/health` and `/api/health/ready` were **not accessible from web retrieval**; the serving production SHA is unverified. No local full Next.js build, SQL write, real Supabase/Twilio SMS or deployed-site E2E test was performed.

**Blockers / access:** WORKLOG coordinator-only merge/deploy gate; live Coolify admin/production secret setup, approved database migration audits/backups, real SMS provider and authorized test accounts/tenant smoke. Prior staging schema evidence: `profiles.email` nullable, `lead_attachments` absent. Keep credentials out of GitHub comments.

**Current task and exact next action:** check final exact-head CI of #193 and #178, inspect any failed step, fix only corresponding feature branch, update WORKLOG and this handoff; then select next independently executable approved item from `docs/DEV-TODO.md` and open a non-overlapping PR. Coordinator alone merges or releases; prove real runtime SHA and health after authorized deployment.

### 2026-10-16 — branch reconciliation after initial handoff
- Auth PR #187 was rebased/reconciled with current main on its feature branch only; latest pushed head `d0d1f88a2231afb7743b0a48694fd761ed72958a`, full CI run [38883687337](https://github.com/takatakca/takatak-v1/actions/runs/38883687337) still underway when checked. The previous head `4f34f264...` passed CI, but that does not substitute for final-head CI. Source files: `trusted-origin.ts`, `auth-json.ts`, register and invited-account routes, `scripts/auth-json-origin-tests.ts`, `package.json`, WORKLOG.
- R2F PR #193 on head `3a457fda6092701fba3ce3f1910b04ad9811c920`: targeted lifecycle contract and Authentication tests succeeded, full CI run [38882991101](https://github.com/takatakca/takatak-v1/actions/runs/38882991101) was building. The existing R2F issue #160 received a factual update; no live adapter was activated.
- This handoff PR #178 on earlier head `c541bb343bfb287d503868af245798a415653250`: `Agent continuation documentation safeguards` step passed and full [CI 38883435630](https://github.com/takatakca/takatak-v1/actions/runs/38883435630) was running. This edit advances its HEAD and triggers further CI.
- Latest verified main is `c53ed4529e03b15a0241f5b96e4ed37d3f50f56e`, main CI success but Coolify deployment jobs skipped; production SHA, SMS provider and real tenant workflows are still unverified. No main write, live provider call or SQL apply in this session.
- **Next exact action:** verify full run conclusion for latest commit of each PR (#187, #193, #178), fix any failure on its existing branch, hand green PRs to WORKLOG-designated merge coordinator. For next unclaimed item inspect current `docs/DEV-TODO.md` and PR titles before taking it; never duplicate active integrations.


## 2026-10-16 13:45 America/Toronto — latest live GitHub checkpoint

**Repo/main:** `takatakca/takatak-v1`, current verified `main=efe4db915d487822441502cc8d036819d31ab51b`. It includes #197 (Next.js build-heap sizing), #198 (smaller Coolify image) and #192 (AI Studio using administrator provider keys). The most recently **verified green main CI** was [38922550660](https://github.com/takatakca/takatak-v1/actions/runs/38922550660) on the prior main `c6bdb9d17f00f18a341b6f787d1040444c0508bb`; **do not infer latest SHA CI**. The Coolify automatic deploy run [38923747787](https://github.com/takatakca/takatak-v1/actions/runs/38923747787) was `skipped`; a release is not proven. Safe public HTTPS GETs to `/api/health/ready` and `/login` could not resolve `takatak.ca` in this tool runtime, so the serving SHA remains unverified (not evidence of site outage).

**Prior PR gates:** #178 full CI success on `5ff089a9f3ade91b5f00e63171de40100da1fcad`; #187 full CI success on `d0d1f88a2231afb7743b0a48694fd761ed72958a`; #193 full CI success on `3a457fda6092701fba3ce3f1910b04ad9811c920`. These remain open and not deployed. New #194/#195 Knowledge AI work is owned by other agents; do not duplicate.

**Last work completed:** new [PR #199](https://github.com/takatakca/takatak-v1/pull/199), `fix/read-only-live-readiness-20261016`, code last pushed `f4791d23a5c66d0fcda1e7beecf035fc2d8a3186`. Changed `scripts/ops/live-readiness.mjs` to avoid login/webhook `POST` and cron GET by default (only `--active-probes` enables these), added `scripts/ops/readiness-contract.mjs` strict HTTP 200 + JSON service checks, `scripts/ops/live-readiness.test.mjs` using local mock fetch, CI step in `.github/workflows/ci.yml`, `docs/COOLIFY_DIRECT_PRODUCTION.md` and `WORKLOG.md`. This closes a false-positive readiness scenario and makes default probes passive; **no live network or secrets were used to test customer journeys**.

**Verification:** GitHub API read of main HEAD, commits, open PRs, WORKLOG/AGENTS, past handoff and workflow source. New PR [CI 38942971983](https://github.com/takatakca/takatak-v1/actions/runs/38942971983) was in progress at the last check. No full CI success is claimed for PR #199 yet. The GitHub-scheduled hourly continuation already exists; keep it grounded in latest Github state.

**Release restrictions & access:** `WORKLOG.md` still reserves all merges/main writes, staging/production deploys, SQL applies and provider changes to the named coordinator. Staging nullable `profiles.email` exists but `lead_attachments` is missing; DB history, backup and owner migration gate remain unresolved. No proof of real Twilio SMS/Phone Auth or live tenant isolation. Never expose any credential.

**Current task / exact next action:** check #199 full CI on final branch SHA. If failing, inspect failed job and correct only this feature branch, updating its WORKLOG and this handoff. If green, coordinator reviews merges #187/#193/#178/#199 one at a time; verify current main CI and separately authorized Coolify live SHA/health before marking production done. Select another non-overlapping code task from DEV-TODO when possible. This PR #178 documentation branch advances its SHA with every append.
