# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`
Full backlog with priorities: knowledgeAI `docs/11-DEV-BACKLOG.md` (branch `claude/ecosystem-integration-map`).

## 🔴 Needs a human (post-its)
Each item is something only a person can do: a secret, an approval, a merge, an account. Done? Delete the line and add a log line `cleared: <item>`. Secret values never go in this file.

- [ ] **Staging migrations: approve and apply.** #147 (the staging apply gate) is merged. Take a backup of the staging Supabase project. Then run "Reconcile TAKATAK staging migrations" with mode `apply` and the approval phrase from `docs/staging-migration-reconciliation.md`. *Blocks:* the staging deploy, including billing. *(2026-10-08; the staging secret is set, and audit run 37762369395 matched the three billing migrations)*
- [ ] **Production secrets.** In GitHub → Settings → Environments → `production`, add the 7 `TAKATAK_PRODUCTION_*` secrets, then run "Promote verified TAKATAK production artifact". *Blocks:* deploying `main` to takatak.ca. *(2026-10-08, session 01KBGh1v)*
- [ ] **Deploy agent secrets.** Add `COOLIFY_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `PROD_DATABASE_URL`, `PROD_DIRECT_URL`, `EMAIL_USER`, `EMAIL_PASSWORD` and an AI provider API key to the Claude cloud environment secrets. *Blocks:* the Coolify test copy and AI features. *(2026-10-08, session 01W1ntbf)*
- [ ] **Approve Facturations #158, #159, #160 as `takatakmtl`.** The agent merges them once approved. *Blocks:* Facturations staging and the issuance status shown to clients. *(2026-10-07, session 01HWFgGo)*
- [ ] **⏸ ON HOLD (owner, 2026-10-09): MIMT is paused. Agents do not start MIMT work until the owner reopens it.** **Share the MIMT repository with Claude.** mimt.ca runs Next.js, but its repo is not visible to agents (`takatakca/mimt`, `MIMT`, `mimtca` not found). Add it in github.com/settings/installations › Claude › Repository access, and write its exact name here. *Blocks:* building the MIMT app and the MIMT API client behind `/dashboard/voip`. *(2026-10-09, session 01HWFgGo)*
- [ ] **MochaHost WordPress cleanup.** Owner decided: keep mielaissa.ca, besoinavocat.ca, actionavocat.ca, inntime.ca; remove every other WordPress site in the bolon.ca cPanel account; never touch takatak.ca, facturations.bolon.ca or the Node apps (1lv, qmaps, rentauto, mimt, pppmtl…), DNS zones, email or domain registrations. Either the owner sends the ticket the agent drafted, or adds `CPANEL_API_TOKEN`, `CPANEL_USER`, `CPANEL_HOST` to the cloud environment secrets so an agent can do it. *(2026-10-09, session 01HWFgGo)*
- [ ] **Approve 2 small migrations (Claude session 01KBGh1v):** `20261010070000_qmaps_listing_review_external_ids` (#136: 2 nullable columns) and `20261010080000_seo_site_audits` (#135: 2 new tables). Both additive. Reply "approve 135 136 migrations"; they then go on the staging list and the PRs merge. *(2026-10-10)*

## ▶ Next up (priority order: first item an agent can do; skip anything waiting on a person)
1. **Homepage redesign: done** (#150 and #151 merged): shorter homepage, ecosystem grid, `/ecosystem` "Our brands" page, premium website. (TK-027 is done: #146.)
2. **After Facturations #160 merges:** pin `FACTURATIONS_REF` in `ci.yml` to the new Facturations `main` and add issue → pay to the contract test.
3. **After the staging apply is approved and run:** check that the three billing migrations are recorded and that staging deploys. Then turn on billing on staging (go-live guide, steps 7–10).
4. Then the `Open work` lines below and knowledgeAI `docs/11-DEV-BACKLOG.md`.

## ⚠ Overlaps: settled (owner, triage 2026-10-08)
- #117 Growth Suite merged whole on 2026-10-09 (owner request, session 01W1ntbf). #135/#136/#137: owner to confirm whether to rebuild them on top of #117 (see docs/DEV-TODO.md §3).
- 1LV bridge: already on main; #7, #17, #18, #23 and #28 closed.
- Billing: #124 on main; #138 closed.
- **Developers: work from `docs/DEV-TODO.md`** (everything left, in order).

## Open work
- 2026-10-10 | cursor | cursor/tk-022-seo-history → #168 | PR | TK-022: weekly SEO re-audits, score history, and a white-label PDF | CI green, then the next developer item
- 2026-10-10 | cursor | cursor/tk-069-ai-studio-handoff → #167 | PR | TK-069: send a saved AI draft into social approval and show that workspace's credit usage and estimated cost | CI
- 2026-10-10 | cursor | cursor/tk-014-catalog-prices → #165 | done (merged) | TK-014: public prices read from ProductCatalog when a CAD plan exists, otherwise the current catalog | seed takatak_public plans when the owner is ready
- 2026-10-10 | claude (session 01KBGh1v) | claude/ai-studio-generation → #137 | PR open, CI running | AI Studio live drafts (OpenAI/Claude) rebuilt on #117; no migration (vendor in job metadata); test key fixed for the secret scan | merge when green; wire #155 resolveProviderKey into readAiStudioConfig once #155 merges
- 2026-10-09 | claude (session 01W1ntbf) | claude/festive-newton-5i9rv7 → #158 | PR open (#157 merged 28d92ba) | Staging migration gate: phone-only verified by live schema; apply deploys pending only when all are approved. Staging audit now PASSES (19 recorded, 10 approved pending) but 15 unapproved repo migrations are unrecorded on staging, so apply would refuse; #158 prints their names | merge #158, re-run staging audit, owner decides on the 15; then backup + apply + staging deploy
- 2026-10-09 | claude (session 01W1ntbf) | claude/festive-newton-5i9rv7 → #117 | done (merged 04bf3fc) | Growth Suite (reputation, analytics, chat, AI agents, Google, plans). Merged main (incl. #151–#154); 9 Growth migrations renamed to 20261009010000–20261009090000 so they sort after the billing migrations (never applied anywhere); rollback script still exact; homepage and Social untouched | owner approved the 9 Growth migrations for staging (2026-10-09): back up staging, run the staging reconciler apply, deploy; production DB approval later; close or merge #135/#136/#137 (overlaps)
- 2026-10-09 | claude (session 01W1ntbf) | fix/phone-first-master-auth → #148 | done (merged d4b0bfa) | Took over at the owner's request: merged main (#147–#154), kept the staging reconciler's history-name map on top of main's migrationHistorySlug; no migration applied, nothing deployed | staging apply (resolve only) and a real SMS test on staging
- 2026-10-08 | cursor | fix/phone-first-master-auth → #148 | PR open | CI run 37788446918 is green on ea8a9bc. Registration profile sync restored. Isolated preview host, Prisma history record, and real SMS are still blocked. | Owner: preview URL plus app root, Supabase Auth provider login, and one Canadian test number. Do not merge or deploy production.
- 2026-10-09 | claude (session 01HWFgGo, voip agent) | claude/voip-dashboard-shell → #152 | done (merged ca86d6d) | VoIP dashboard shell (/dashboard/voip): numbers, calls, voicemail, transfers; shows "MIMT not connected" until MIMT is wired | on hold: MIMT paused by the owner; MIMT API client (Gate 3) when reopened
- 2026-10-09 | claude (session 01HWFgGo, website agent) | claude/website-premium → PR | done (merged d06542f) | Premium website: 9 core categories, sales page per category, real imagery, interactions | owner merges
- 2026-10-08 | claude (session 01HWFgGo, homepage agent) | claude/homepage-redesign → #150 | done (merged 4e91de9) | Shorter homepage (5 sections), ecosystem grid, /ecosystem "Our brands" page | owner merges; owner confirms which brands GROUPE TAKATAK owns and runs (registry marks none as owned + active yet, so the brand list is empty and its links are hidden)
- 2026-10-08 | claude (session 01HWFgGo) | claude/lead-order-billing → #146 | done (merged 750dad3) | TK-027: won takatak.ca order lead → billing queue → Facturations draft (Invoice card on the lead page, explicit taxes) | owner merges; then mark an order Won and create its invoice request
- 2026-10-09 | claude (session 01KBGh1v) | main | done (owner approved) | PR triage applied. Merged #101 #95 (#129 #144 #146 #147 #148 by other sessions). Closed #7 #17 #18 #23 #28 #145 #140 (folded into #143). Decisions noted on #117 #128 #104 #27. Full dev list: docs/DEV-TODO.md | done: #75 and #143 merged too. Next: owner confirms #135-#137 after #117 merged
- 2026-10-08 | cursor | fix/staging-migration-audit → #147 | done (merged 82df62e by session 01HWFgGo) | Manual and automatic staging releases now require the same migration-approval evidence. An audit skips the release and cannot select apply. `website_lead_attachments` is still the missing migration. No backup has been taken and no SQL was applied. | Merge #147 only to install the gate. Apply stays a separate approval after a staging backup.
- 2026-10-08 | claude (session 01KBGh1v) | claude/brand-blue → #142 | done (merged 4103db4) | Public site from green to GROUPE TAKATAK brand blue (tokens, 58 classes, share image) | swap the old gold TK logo after the owner uploads files to knowledgeAI/brand/
- 2026-10-08 | claude (session 01KBGh1v) | main | ready to deploy | main now has #130–#134 and #139 merged (colours, cleanup, website requests→Leads, https/SEO, work log) | owner: add the 7 TAKATAK_PRODUCTION_* secrets in GitHub › Settings › Environments › production, then run "Promote verified TAKATAK production artifact" (validate, then promote)
- 2026-10-08 | owner + TAKATAK-V1 session (01W1ntbf) | Coolify deploy | blocked: secrets | Deploy: takatak.ca via GitHub Actions "Promote verified TAKATAK production artifact" (needs 7 TAKATAK_PRODUCTION_* secrets in GitHub › Environments › production); test copy at knowledge.takatak.ca via Coolify | owner adds COOLIFY_API_TOKEN, SUPABASE_ACCESS_TOKEN, PROD_DATABASE_URL, PROD_DIRECT_URL, EMAIL_USER, EMAIL_PASSWORD to the cloud environment secrets + an AI provider API key, then starts a new session
- 2026-10-10 | claude (session 01KBGh1v) | claude/seo-site-audit → #135 | PR ready, needs owner | Saved multi-page SEO audits added as a section of #117's SEO page; migration renamed 20261010080000_seo_site_audits, on no approved list | owner approves that migration (Needs a human), then merge
- 2026-10-10 | claude (session 01KBGh1v) | claude/qmaps-listings-reviews-sync → #136 | PR ready, needs owner | QMAPS listings/reviews rebuilt on #117; migration renamed 20261010070000_qmaps_listing_review_external_ids, on no approved list | owner approves that migration (Needs a human), then merge

- 2026-10-08 | claude (session 01HWFgGo) | claude/needs-human-board → #144 | merging | "Needs a human" post-its + "Next up" queue at the top of this log | agents keep both lists true
- 2026-10-08 | claude (session 01HWFgGo) | claude/client-billing-dashboard → #129 | done (merged 3e81fdf) | Client billing dashboard: summary, filters, remind / void / mark paid, sidebar entry | —
- 2026-10-08 | other agent | feature/havana-customer-intelligence → #128 | draft | Tenant-isolated customer intelligence (CRM) | finish or close
- 2026-10-05 | other agent | infra/contabo-coolify → #104 | draft | Contabo/Coolify hosting foundation | owner: is hosting moving off MochaHost?
- 2026-10-05 | other agent | claude/alkao-sync → #101 | PR open | TAKATAK → ALKAO sync (read-only, off) | review/merge
- 2026-10-05 | other agent | claude/alkao-ticketing-menu → #95 | PR open | ALKAO ticketing menu (off by default) | review/merge
- 2026-10-03 | other agent | cursor/cloud-agent-env-8e4e → #75 | draft | Cloud agent local setup docs | merge or close
- 2026-10-03 | other agent | hardening/1lv-customer-relationship-projection → #28 | draft | 1LV relationship hardening | part of 1LV decision
- 2026-10-02 | other agent | feature/food-hub → #27 | PR open | Food Hub inside dashboard | review/merge
- 2026-10-02 | other agent | integration/1lv-mastermind-bridge → #23 | draft, DO NOT MERGE | 1LV identity/OTP bridge | part of 1LV decision
- 2026-10-01 | other agent | feature/1lv-master-bridge → #18 | draft | 1LV commerce bridge | part of 1LV decision
- 2026-10-01 | other agent | feature/1lv-master-identity-bridge → #17 | draft | 1LV identity bridge | part of 1LV decision
- 2026-09-30 | other agent | upgrade/1lv-master-marketplace-ingestion-v2 → #7 | draft | 1LV marketplace ingestion | part of 1LV decision

## Done
- 2026-10-08 | claude (session 01KBGh1v) | main (all 32 repos) | done | BRAND.md + brand rule in AGENTS.md everywhere (Facturations via PR #162); production artifact validated (run 37749578770) | owner adds production secrets, then promote
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-theme-colors → #131 | merged | Website colour classes (bg-primary etc.) render again (~700 classes); CI guard qa:website-theme | upload a production build to put it live
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-seo-https → #132 | merged | http→https redirect, canonical URLs, og:image, JSON-LD, shorter titles | upload a production build to put it live
- 2026-10-08 | claude (session 01KBGh1v) | claude/lead-detail-missing-table → #139 | merged | Lead page works before the lead_attachments migration runs | upload a production build to put it live
- 2026-10-08 | claude (session 01KBGh1v) | claude/agent-worklog-rule → #130 | merged | Work log rule, this log, stop reminder (rule also in the other 31 TAKATAK repos; Facturations via PR #162) | upload a production build to put it live
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-lead-capture → #134 | merged | Website forms + checkout → Leads, notifications, file uploads, lead page | set WEBSITE_LEADS_* env; approve migration 20261008090000 for production
- 2026-10-08 | claude (session 01KBGh1v) | claude/repo-hygiene → #133 | merged | Removed 9 stray backups, compact promo invite, lint | none
