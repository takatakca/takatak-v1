# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`
Full backlog with priorities: knowledgeAI `docs/11-DEV-BACKLOG.md` (branch `claude/ecosystem-integration-map`).

## ⚠ Overlaps to settle before more work (owner decision)
- **SEO audit** is built twice: `claude/seo-site-audit` and the Growth Suite (#117). Keep one.
- **Reviews / reputation** are built twice: `claude/qmaps-listings-reviews-sync` (QMAPS reviews in Local Listings) and #117 (Birdeye-style reputation). Decide which screen is the reviews dashboard.
- **AI** is built twice: `claude/ai-studio-generation` (AI Studio drafts) and #117 (AI agents with credits). Decide which one owns content generation.
- **1LV bridge** has four overlapping drafts: #7, #17, #18, #23. Keep one.
- **Billing:** #129 (Stripe client invoicing, merged base #124) and `claude/facturations-billing-integration` (Facturations/Wave drafts) are different systems. Confirm both are wanted.

## Open work
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-theme-colors → #131 | ready | Website buttons/accents render colourless (~700 classes); fix + CI guard | merge first; then upload a production build
- 2026-10-08 | claude (session 01KBGh1v) | claude/repo-hygiene → #133 | ready | Remove 9 stray backups, compact promo invite, lint | merge
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-seo-https → #132 | ready | http→https redirect, canonical, og:image, JSON-LD, titles | merge; after upload re-audit takatak.ca
- 2026-10-08 | claude (session 01KBGh1v) | claude/website-lead-capture → #134 | ready, needs main merged in | Website forms + checkout → Leads, notifications, file uploads, lead page | merge main in, migration 20261006150000, set WEBSITE_LEADS_* env
- 2026-10-08 | claude (session 01KBGh1v) | claude/seo-site-audit → #135 | hold (overlaps #117) | SEO audit dashboard | owner picks this or #117
- 2026-10-08 | claude (session 01KBGh1v) | claude/qmaps-listings-reviews-sync → #136 | hold (overlaps #117) | QMAPS listings/reviews → V1 | owner decides reviews owner
- 2026-10-08 | claude (session 01KBGh1v) | claude/ai-studio-generation → #137 | hold (overlaps #117) | AI Studio draft generation (OpenAI/Claude) | owner decides AI owner
- 2026-10-08 | claude (session 01KBGh1v) | claude/facturations-billing-integration → #138 | hold | Read-only Facturations invoice drafts | waits on Facturations staging (TK-030)
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
- 2026-10-08 | claude (session 01KBGh1v) | claude/agent-worklog-rule → #130 | PR open | Work log rule, this log, stop reminder; same rule pushed to the other TAKATAK repos (Facturations via its PR #162) | merge #130
