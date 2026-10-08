# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`
Full backlog with priorities: knowledgeAI `docs/11-DEV-BACKLOG.md` (branch `claude/ecosystem-integration-map`).

## ⚠ Overlaps to settle before more work (owner decision)
- **SEO audit** is built twice: `claude/seo-site-audit` and the Growth Suite (#117). Keep one.
- **Reviews / reputation** are built twice: `claude/qmaps-listings-reviews-sync` (QMAPS reviews in Local Listings) and #117 (Birdeye-style reputation). Decide which screen is the reviews dashboard.
- **AI** is built twice: `claude/ai-studio-generation` (AI Studio drafts) and #117 (AI agents with credits). Decide which one owns content generation.
- **1LV bridge** has four overlapping drafts: #7, #17, #18, #23. Keep one.
- **Billing:** `main` already has a Facturations integration (#124: billing request queue → Facturations drafts). `claude/facturations-billing-integration` (#138) is likely a duplicate: compare, then close #138. #129 (Stripe client invoicing) is a separate system.

## Open work
- 2026-10-08 | claude (session 01KBGh1v) | main | waiting on owner | Triage of all 23 open PRs. Merge: #144 #129 #146 #147 #101 #95 #75. Close: #7 #17 #18 #23 (already on main), #145 (dup of #148). Owner yes/no: #148, #135-137 vs #117 (split #117), #128, #104, #27, #28, #143/#140 | owner replies "approve triage" (Launch Board step 6); then merge in that order and close
- 2026-10-08 | claude (session 01KBGh1v) | claude/brand-blue → #142 | done (merged 4103db4) | Public site from green to GROUPE TAKATAK brand blue (tokens, 58 classes, share image) | swap the old gold TK logo after the owner uploads files to knowledgeAI/brand/
- 2026-10-08 | claude (session 01KBGh1v) | main | ready to deploy | main now has #130–#134 and #139 merged (colours, cleanup, website requests→Leads, https/SEO, work log) | owner: add the 7 TAKATAK_PRODUCTION_* secrets in GitHub › Settings › Environments › production, then run "Promote verified TAKATAK production artifact" (validate, then promote)
- 2026-10-08 | owner + TAKATAK-V1 session (01W1ntbf) | Coolify deploy | blocked: secrets | Deploy: takatak.ca via GitHub Actions "Promote verified TAKATAK production artifact" (needs 7 TAKATAK_PRODUCTION_* secrets in GitHub › Environments › production); test copy at knowledge.takatak.ca via Coolify | owner adds COOLIFY_API_TOKEN, SUPABASE_ACCESS_TOKEN, PROD_DATABASE_URL, PROD_DIRECT_URL, EMAIL_USER, EMAIL_PASSWORD to the cloud environment secrets + an AI provider API key, then starts a new session
- 2026-10-08 | claude (session 01KBGh1v) | claude/seo-site-audit → #135 | hold (overlaps #117) | SEO audit dashboard | owner picks this or #117
- 2026-10-08 | claude (session 01KBGh1v) | claude/qmaps-listings-reviews-sync → #136 | hold (overlaps #117) | QMAPS listings/reviews → V1 | owner decides reviews owner
- 2026-10-08 | claude (session 01KBGh1v) | claude/ai-studio-generation → #137 | hold (overlaps #117) | AI Studio draft generation (OpenAI/Claude) | owner decides AI owner
- 2026-10-08 | other agent | claude/client-billing-dashboard → #129 | PR open | Stripe client billing page actions | review/merge
- 2026-10-08 | other agent | feature/havana-customer-intelligence → #128 | draft | Tenant-isolated customer intelligence (CRM) | finish or close
- 2026-10-07 | other agent | claude/festive-newton-5i9rv7 → #117 | PR open, 15k lines | Growth Suite (reputation, analytics, chat, AI agents, Google, plans) | settle overlaps above, then review
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
