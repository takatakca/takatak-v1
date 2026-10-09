# Developer to-do: what's left to finish TAKATAK

Updated 2026-10-09, after the owner-approved PR triage. One list for developers and AI agents. Work top to bottom; skip any line waiting on a person (marked **Owner**).

Before starting anything, follow `AGENTS.md` (work log rule and brand rule):
- Claim your line in `WORKLOG.md`.
- One PR per item.
- CI must be green.
- Never put secrets in the repo.
- Never add a migration to the **production** approved list. That needs the owner.

Backlog ids (TK-…) refer to knowledgeAI `docs/11-DEV-BACKLOG.md`.

## 1. Go live (highest priority)

| # | Who | Task | Done when |
|---|---|---|---|
| 1.1 | **Owner** | Add the 7 `TAKATAK_PRODUCTION_*` secrets (GitHub → Settings → Environments → `production`) | The secrets exist |
| 1.2 | Dev | Run **"Promote verified TAKATAK production artifact"** (`release-production.yml`) with the latest green `main` SHA and its CI run id: first `mode: validate`, then `promote` (see `docs/TAKATAK_PRODUCTION_PROMOTION.md`) | takatak.ca serves the new build |
| 1.3 | Dev | Smoke-test production (checklist below this table) | All pass; record the result in `WORKLOG.md` |
| 1.4 | Dev | Turn on website lead capture in production: `WEBSITE_LEADS_ENABLED=true`, `WEBSITE_LEADS_CLIENT_ID`, optional `WEBSITE_LEADS_NOTIFY_EMAIL`. For uploads, also a private Supabase bucket plus `WEBSITE_LEADS_UPLOAD_SECRET` (see `docs/WEBSITE_LEAD_CAPTURE.md`) | A test form submission appears in `/dashboard/leads` |
| 1.5 | **Owner** + Dev | Approve and apply on staging first, then production: `20261008090000_website_lead_attachments` (lead files) and `20261008153000_phone_only_profile_email` (phone-only sign-up, #148). Both are on the **staging** list only. Until they're applied in production, file uploads stay off and phone-only accounts can't be created there | Each migration is recorded in staging, then production |
| 1.6 | Dev | Send a real SMS through the staging Supabase phone provider (Twilio) and confirm that a phone-only account reaches the dashboard (#148 test plan) | Screenshot plus log line |
| 1.7 | **Owner** → Dev | Owner uploads the official logo files to knowledgeAI `brand/`. Dev replaces the old gold "TK" logo (`src/components/brand/takatak-logo.tsx`, `public/img/imgtak/*`) everywhere | No gold TK logo left on the site or dashboard |

**Smoke test (1.3):**
- `http://takatak.ca` redirects to https.
- The home page and `/ecosystem` load.
- Sign-up by phone works.
- Post a project → the lead appears in the dashboard.
- Checkout "Send order to TAKATAK" → a high-priority lead with the right total.
- Lead status update works.
- `/dashboard/notifications` shows the new lead.
- No console errors.

## 2. AI Studio server (knowledge.takatak.ca)

The kit is in knowledgeAI `deploy/ai-studio/` (README has every command).

| # | Who | Task | Done when |
|---|---|---|---|
| 2.1 | **Owner** | Create the server (Oracle Always Free ARM, or any VPS) and API keys, then run the 3 install lines | `install.sh` prints "running" |
| 2.2 | **Owner** | DNS A records `knowledge` and `lab` → server IP | HTTPS works on both |
| 2.3 | Dev | Send one message per AI brand and check that the credit balance goes down (`./admin.sh balances`) | Every brand answers and is charged |
| 2.4 | Dev | Nightly backup: cron `./admin.sh backup`, copy the archive off the server, test one restore | Restore proven |
| 2.5 | Dev | TK-072: GROUPE TAKATAK logo and colours on both apps | Screenshots |
| 2.6 | Dev | TK-071: a paid Facturations invoice for an AI Studio plan adds its credits automatically, exactly once | Paid test invoice → credits; a replay does not double them |
| 2.7 | Dev | TK-073 / TK-074 (more than 2 models side by side for clients; document search). Only if clients ask | Owner decision |

## 3. Finish the open pull requests (owner decisions from the triage)

| PR | Task |
|---|---|
| #75, #143 | Merge when CI is green (Claude session 01KBGh1v is doing this). |
| #135 SEO audit, #136 QMAPS reviews, #137 AI drafts | Approved to keep (they win over #117). For each: merge `main` in, rename its migration to a date after `20261008153000`, **remove it from the production approved list** (keep it on the staging list), get CI green, merge. One at a time. |
| #117 Growth Suite | Split into one PR per phase: reputation (writes into the same listing reviews as #136), analytics, website chat, agents and credits (on top of #137), Google, plans. Same migration rules. Drop the parts #135–#137 already cover. |
| #128 Customer intelligence | **Blocked:** privacy review (Quebec Law 25: consent, purpose, retention, access, deletion) before any production migration. |
| #104 Coolify, #27 Food Hub | **Frozen** until the site is live (owner decision). See the PR comments for what each needs when picked up. |
| MIMT | **Paused by the owner** (see `WORKLOG.md`). Don't start MIMT work. |

## 4. Product gaps (after go-live; one PR each)

| Id | Task |
|---|---|
| TK-013 | Promo codes are browser-only (`lib/website/promotions.ts`, stub `api-client.ts`). Validate them on the server. |
| TK-014 | Website prices are hard-coded (`lib/website/pricing.ts`, `marketplace-packages.ts`). Read them from `ProductCatalog` / `ProductPrice`. |
| TK-019 | **Owner** decides: the marketplace says "escrowed payments", but no escrow exists. Fix the copy or build it. |
| TK-069 | AI Studio in the dashboard: "send draft to approval", handoff to social publishing, usage and cost view. |
| TK-024 | Reply to reviews from TAKATAK (needs a QMAPS-side API); Google Business reviews. |
| TK-021 | Google Search Console OAuth for keywords and backlinks (**Owner** creates the Google Cloud OAuth app). |
| TK-022 | SEO: weekly re-audits, score history, white-label PDF. |
| TK-026 | Reports: export and delivery. |
| TK-065 | Antivirus scan for lead attachments (they're stored `quarantined`, download-only). |
| TK-004 / TK-025 | Link each QMAPS business to its client workspace; admin screen instead of the CLI script. |
| TK-008 / TK-052 | QMAPS: run `takatak-sync-outbox` once on staging; fix the red lint on qmaps `main`. |

## 5. Facturations (billing)

| Id | Task |
|---|---|
| — | Facturations #158, #159, #160: **Owner** approves as `takatakmtl`, then they're merged. After #160, pin `FACTURATIONS_REF` in `ci.yml` and add issue → pay to the contract test. |
| — | Staging: approve and run the staging migration apply (`WORKLOG.md` → Needs a human), then turn on billing on staging (go-live guide, steps 7–10). |
| TK-030 / TK-031 | **Owner:** isolated Facturations staging (HTTPS, own database, backups); one deployment per business, or multi-business support. |
| TK-032 / TK-033 | Remaining items in the Facturations README "Non livrés ou non vérifiés"; review its open AI/integration PRs (OpenAI use needs explicit owner approval). |

## 6. Security and operations

| Id | Task |
|---|---|
| TK-050 | **Owner, P0:** credential material is committed in a public legacy repository. Rotate it and remove it (details are with the owner). |
| TK-043 | Retire the legacy takatak.ca site and MongoDB auth backend (a second identity system). |
| TK-054 | Add HSTS once every takatak.ca subdomain serves HTTPS. |
| TK-051 | Branch protection on `main`: deferred by the owner. Don't turn it on without asking. |
| TK-040 | 1LV and Rentauto → V1 events: contracts exist; **Owner** sets the secrets on both servers. |
