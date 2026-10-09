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
- [ ] **Owner decisions** listed under "Overlaps to settle" below.

## ▶ Next up (priority order: first item an agent can do; skip anything waiting on a person)
1. **Homepage redesign: done** (#150 and #151 merged): shorter homepage, ecosystem grid, `/ecosystem` "Our brands" page, premium website. (TK-027 is done: #146.)
2. **After Facturations #160 merges:** pin `FACTURATIONS_REF` in `ci.yml` to the new Facturations `main` and add issue → pay to the contract test.
3. **After the staging apply is approved and run:** check that the three billing migrations are recorded and that staging deploys. Then turn on billing on staging (go-live guide, steps 7–10).
4. Then the `Open work` lines below and knowledgeAI `docs/11-DEV-BACKLOG.md`.

## ⚠ Overlaps to settle before more work (owner decision)
- **SEO audit** is built twice: `claude/seo-site-audit` and the Growth Suite (#117). Keep one.
- **Reviews / reputation** are built twice: `claude/qmaps-listings-reviews-sync` (QMAPS reviews in Local Listings) and #117 (Birdeye-style reputation). Decide which screen is the reviews dashboard.
- **AI** is built twice: `claude/ai-studio-generation` (AI Studio drafts) and #117 (AI agents with credits). Decide which one owns content generation.
- **1LV bridge** has four overlapping drafts: #7, #17, #18, #23. Keep one.
- **Billing:** `main` already has a Facturations integration (#124: billing request queue → Facturations drafts). `claude/facturations-billing-integration` (#138) is likely a duplicate: compare, then close #138. #129 (Stripe client invoicing) is a separate system.

## Open work
- 2026-10-09 | claude (session 01W1ntbf) | claude/festive-newton-5i9rv7 → #117 | PR open, up to date with main | Growth Suite (reputation, analytics, chat, AI agents, Google, plans). Merged main (incl. #151–#154); 9 Growth migrations renamed to 20261009010000–20261009090000 so they sort after the billing migrations (never applied anywhere); rollback script still exact; homepage and Social untouched | owner settles the overlaps above (#135/#136/#137 vs #117, or split #117); Growth migrations stay out of the approved deploy lists until the owner approves
- 2026-10-09 | claude (session 01HWFgGo, voip agent) | claude/voip-dashboard-shell → #152 | done (merged ca86d6d) | VoIP dashboard shell (/dashboard/voip): numbers, calls, voicemail, transfers; shows "MIMT not connected" until MIMT is wired | on hold: MIMT paused by the owner; MIMT API client (Gate 3) when reopened
- 2026-10-09 | claude (session 01HWFgGo, website agent) | claude/website-premium → PR | done (merged d06542f) | Premium website: 9 core categories, sales page per category, real imagery, interactions | owner merges
- 2026-10-08 | claude (session 01HWFgGo, homepage agent) | claude/homepage-redesign → #150 | done (merged 4e91de9) | Shorter homepage (5 sections), ecosystem grid, /ecosystem "Our brands" page | owner merges; owner confirms which brands GROUPE TAKATAK owns and runs (registry marks none as owned + active yet, so the brand list is empty and its links are hidden)
- 2026-10-08 | claude (session 01HWFgGo) | claude/lead-order-billing → #146 | done (merged 750dad3) | TK-027: won takatak.ca order lead → billing queue → Facturations draft (Invoice card on the lead page, explicit taxes) | owner merges; then mark an order Won and create its invoice request
- 2026-10-08 | claude (session 01KBGh1v) | main | waiting on owner | Triage of all 23 open PRs. Merge: #144 #129 #146 #147 #101 #95 #75. Close: #7 #17 #18 #23 (already on main), #145 (dup of #148). Owner yes/no: #148, #135-137 vs #117 (split #117), #128, #104, #27, #28, #143/#140 | owner replies "approve triage" (Launch Board step 6); then merge in that order and close
- 2026-10-08 | cursor | fix/staging-migration-audit → #147 | done (merged 82df62e by session 01HWFgGo) | Manual and automatic staging releases now require the same migration-approval evidence. An audit skips the release and cannot select apply. `website_lead_attachments` is still the missing migration. No backup has been taken and no SQL was applied. | Merge #147 only to install the gate. Apply stays a separate approval after a staging backup.
- 2026-10-08 | claude (session 01KBGh1v) | claude/brand-blue → #142 | done (merged 4103db4) | Public site from green to GROUPE TAKATAK brand blue (tokens, 58 classes, share image) | swap the old gold TK logo after the owner uploads files to knowledgeAI/brand/
- 2026-10-08 | claude (session 01KBGh1v) | main | ready to deploy | main now has #130–#134 and #139 merged (colours, cleanup, website requests→Leads, https/SEO, work log) | owner: add the 7 TAKATAK_PRODUCTION_* secrets in GitHub › Settings › Environments › production, then run "Promote verified TAKATAK production artifact" (validate, then promote)
- 2026-10-08 | owner + TAKATAK-V1 session (01W1ntbf) | Coolify deploy | blocked: secrets | Deploy: takatak.ca via GitHub Actions "Promote verified TAKATAK production artifact" (needs 7 TAKATAK_PRODUCTION_* secrets in GitHub › Environments › production); test copy at knowledge.takatak.ca via Coolify | owner adds COOLIFY_API_TOKEN, SUPABASE_ACCESS_TOKEN, PROD_DATABASE_URL, PROD_DIRECT_URL, EMAIL_USER, EMAIL_PASSWORD to the cloud environment secrets + an AI provider API key, then starts a new session
- 2026-10-08 | claude (session 01KBGh1v) | claude/seo-site-audit → #135 | hold (overlaps #117) | SEO audit dashboard | owner picks this or #117
- 2026-10-08 | claude (session 01KBGh1v) | claude/qmaps-listings-reviews-sync → #136 | hold (overlaps #117) | QMAPS listings/reviews → V1 | owner decides reviews owner
- 2026-10-08 | claude (session 01KBGh1v) | claude/ai-studio-generation → #137 | hold (overlaps #117) | AI Studio draft generation (OpenAI/Claude) | owner decides AI owner
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
