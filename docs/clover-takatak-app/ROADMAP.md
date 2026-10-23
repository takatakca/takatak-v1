# Roadmap: the TAKATAK Clover app

Status: plan, 2026-10-23. Each phase ends only when **all** its acceptance checks pass. Times are rough estimates
(INFERENCE): Google, Meta and Clover reviews have no published deadline.

Owner rules that apply to every phase: never commit, push or merge `main` (the owner merges); no secrets in this public
repo; brands are real restaurants (never "virtual" or "ghost"); never "24h"; each delivery platform hears only about
itself; Po Poulet NDG is never touched (put its Clover merchant ID in the hard block list before any live test).

## P0 — Legal and compliance prerequisites (start now; mostly owner and outside parties)

| # | Item | Who | Acceptance check |
|---|---|---|---|
| P0.1 | Owner answers [OWNER_DECISIONS.md](OWNER_DECISIONS.md) (at least D1–D10) | Owner | Answers written in the PR or in the private board |
| P0.2 | Québec lawyer engaged; questions in [LEGAL_QUEBEC_CANADA.md](LEGAL_QUEBEC_CANADA.md) §13 answered | Owner + lawyer | Written answers kept privately (not in this repo) |
| P0.3 | Person in charge of personal information named (P-39.1 s.3.1); title and a role contact published on takatak.ca/privacy | Owner, then dev | Visible on the live privacy page |
| P0.4 | Privacy impact assessment (CAI guide v3.1) for the app, incl. transfers outside Québec | Owner + dev | PIA document signed by the person in charge |
| P0.5 | Data region decided (D10); if moving, plan approved | Owner | Decision recorded |
| P0.6 | Legal documents drafted for this app: EULA FR + EN (French shown first), privacy policy section, data processing agreement, sub-processor list, governance page (s.3.2), incident register | Dev drafts, lawyer reviews | Lawyer's OK; pages live on takatak.ca under final URLs |
| P0.7 | Meta Business Verification, then Access Verification as Tech Provider | Owner (documents) | "Verified" shown in Meta Business settings |
| P0.8 | Google: Business Profile API access granted for the takatak-v1 Cloud project; agency organization on the takatak.ca domain; OAuth consent screen verified for `business.manage` | Owner applies, dev prepares | 300 QPM visible in the Cloud console; organization exists |
| P0.9 | Questions sent to Clover DevRel ([RESEARCH_CLOVER.md](RESEARCH_CLOVER.md) open questions 1–8 and 12) | Owner sends from the developer account | Answers received and summarized in the PR |
| P0.10 | New Clover app created in **sandbox**: Web, App Market, Canada, FR-CA + EN-CA; name per D1; Site URL per D4 | Owner (dashboard), dev (values) | Sandbox App ID exists; draft `N4NYCJCZ17FF4` untouched |
| P0.11 | Fixes in takatak-v1 needed before any Clover merchant: (a) purge Google review copies older than 30 days; (b) same review invitation for every rating in the public rating form; (c) data-deletion page shows one consistent address; (d) Meta data deletion callback | Dev (separate PRs) | Tests for each; PRs ready for owner merge |
| P0.12 | Hard block list and "own merchants" list defined (env names only in the repo) | Owner | Values set in Coolify, never in git |

## P1 — MVP: Clover install → TAKATAK workspace → Google + Facebook + Instagram

| # | Item | Acceptance check |
|---|---|---|
| P1.1 | Clover connector ported (OAuth v2, refresh lock, webhook gate, entitlement), gate off by default | Unit tests ported from Food Hub pass; with env unset, every Clover route answers 404 and nothing else changes |
| P1.2 | Install flow: `/clover/launch` → OAuth → workspace → onboarding pre-filled (FR first) | In the Clover sandbox: install → onboarding pre-filled with the sandbox merchant's name and address; the person signs in with the existing OTP |
| P1.3 | Clover read + normalized menu and hours (+ photo mapping screen) | Sandbox menu of 3+ categories shows in TAKATAK with correct prices in CAD; hidden items left out; test on modifier groups |
| P1.4 | Channel consents (per channel, per data type, sync or approve-each), revocable | Consent row stored with person, time, IP, text version; revoke stops queued jobs in a test |
| P1.5 | Publish queue + adapters, dry run by default | Dry run shows the exact API payload; no network call when `TAKATAK_PUBLISHING_LIVE` is off |
| P1.6 | Google adapter: info, regular and special hours, menu (`updateMask`), photos, posts with ORDER button, Order online link (`MERCHANT`) | On a TAKATAK test location: price changed in Clover → Google menu read back with the new price; nothing else in the menu changed |
| P1.7 | Facebook adapter: posts and photos | Approved post appears on a test Page; a post not approved is never sent (test) |
| P1.8 | Instagram adapter: posts (JPEG, public URL), after App Review of `instagram_business_content_publish` | Approved post appears on a test account; container status handled; daily cap enforced |
| P1.9 | Approvals wired: draft → pending_approval → approved → scheduled → published / failed | Each transition in `AuditLog`; only allowed transitions (existing `canTransitionPost`) |
| P1.10 | Webhooks `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH` → re-sync | Changing hours in the sandbox queues one hours update, not a full re-push; out-of-stock never creates a post |
| P1.11 | Entitlement gate from `billing_info`; Stripe checkout hidden for Clover workspaces | Tests for trial, active, lapsed (read-only, restored on active), inactive; no Stripe button visible in a Clover workspace |
| P1.12 | Uninstall: notice, export, deletion after the window | Sandbox uninstall → tokens gone at once; data deleted after the window (test with a short window); audit entries present |
| P1.13 | Tenant isolation | `qa:tenant-isolation` extended with Clover cases, all pass |
| P1.14 | French first everywhere (screens, emails, errors, help) | Review of every screen in FR; EN available |
| P1.15 | Live pilot on TAKATAK's own real restaurants (never Po Poulet NDG), one channel at a time | Each channel published once for real and read back; no error in logs for 7 days |
| P1.16 | Repo checks | `npm run typecheck`, `npm run lint`, `npm test` (and the repo's QA scripts) green on each PR |

## Clover submission checklist (after P1, and after first feedback on Food Hub or Phone AI)

- [ ] At least one channel works end to end in production; the listing names **only** working channels.
- [ ] App name (D1), icon distinct from Food Hub and Phone AI, optional cover 1080×216.
- [ ] FR-CA and EN-CA tabs: tagline ≤255, 3–5 benefits ≤100, description with setup requirements (Google profile,
      Facebook Page, Instagram professional account, menu in Clover Inventory, photos uploaded in TAKATAK).
- [ ] Screenshots (web, ≤1920×1080), at least one functional and one vertical category.
- [ ] EULA and privacy policy URLs, written for this app, French first, matching the two permissions requested.
- [ ] Support site: FAQ, email, phone, hours; quick reference guide.
- [ ] Permissions: Merchant read + Inventory read, each with a justification.
- [ ] Webhook URL verified; events `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH`.
- [ ] Site URL and Alternate Launch Path on the final takatak.ca domain (same base domain).
- [ ] Pricing: 14-day trial, monthly tier(s), metered events (if any) — settled, in the right currency (DevRel answer).
- [ ] Country: Canada; modules availability set (menu sync needs Items).
- [ ] Functional review video + description: install → pre-filled onboarding → connect Google → consent → preview →
      approve → publish → change a price in Clover → sync → uninstall.
- [ ] No Stripe, no ads, no cross-promotion inside the app; posts link to Clover online ordering.
- [ ] No "first", "only", partnership or endorsement claims ([MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md)).
- [ ] SRM question answered by DevRel.
- [ ] Domain, permissions, languages, countries and legal URLs frozen (changes after approval mean a new review).

## P2 — More channels and multi-location

| # | Item | Acceptance check |
|---|---|---|
| P2.1 | Pinterest Pins (image + link to Clover ordering) | Pinterest Standard access granted; a Pin is publicly visible |
| P2.2 | Threads posts | App Review passed; post published |
| P2.3 | TikTok (video) | TikTok audit passed; post public |
| P2.4 | Facebook Page hours and info (if writable) | Read-back matches Clover |
| P2.5 | Google review replies for Clover merchants (approval-gated, opt-in auto-reply) | Reply posted only after approval or recorded opt-in |
| P2.6 | Guided manual set-up for Apple Business Connect, Bing Places, Yelp (ready-to-paste text and photos) | Merchant checklist in FR and EN; no promise in the Clover listing |
| P2.7 | Several Clover merchants linked into one workspace (proof of control for each) | Tenant tests pass; unlinking works |
| P2.8 | Each new channel added to the Clover listing as a reviewed update | Clover approval of the update |

## P3 — AI content, with disclosure

| # | Item | Acceptance check |
|---|---|---|
| P3.1 | AI drafts for menu descriptions (FR, then EN) from Clover data only | No price, allergen or health claim that is not in merchant data (automated check) |
| P3.2 | Weekly post plan (drafts) per brand | All drafts land in `pending_approval` |
| P3.3 | Claim and word checks before approval: no "first/only/#1", no "24h", no "virtual/ghost", no invented discount, Clover price match | Blocking test cases pass |
| P3.4 | Disclosure: "Texte proposé par l'IA — à valider" in the app; AI images (if ever allowed) labelled (`is_ai_generated` on Instagram) and never shown as real dishes | Visible in UI; flag set in API payloads |
| P3.5 | Optional auto-publish: explicit, recorded, revocable opt-in per channel; weekly summary email | Opt-in row exists before any auto post; revoke stops the next post |
| P3.6 | Metered AI events (only if decided in D5) | Sent exactly once per event; dry run until turned on |
| P3.7 | French by default for Québec merchants, French at least equal on bilingual posts | Language check in tests |

## Not on this roadmap (on purpose)

- A TAKATAK public directory or marketplace fed by Clover data (Clover s.4.3, s.18): needs Clover's written OK or a
  separate merchant agreement on non-Clover data.
- Any plugin or code installed on Clover devices.
- Pushing menus to delivery marketplaces (Food Hub's job).
