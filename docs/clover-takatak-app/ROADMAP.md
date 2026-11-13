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
| P0.4 | Privacy impact assessment (CAI guide v3.1) for the app, incl. transfers outside Québec: database, app server (Coolify host), TAKATAK AI Gateway and **each** AI provider on the Clover allowlist (P1.18), Google, Meta | Owner + dev | PIA document signed by the person in charge; review text sent to AI is in scope |
| P0.5 | Data region decided (D10); if moving, plan approved | Owner | Decision recorded |
| P0.6 | Legal documents drafted for this app: EULA FR + EN (French shown first), privacy policy section, data processing agreement, sub-processor list, governance page (s.3.2), incident register | Dev drafts, lawyer reviews | Lawyer's OK; pages live on takatak.ca under final URLs |
| P0.7 | Meta Business Verification, then Access Verification as Tech Provider | Owner (documents) | "Verified" shown in Meta Business settings |
| P0.8 | Google: Business Profile API access granted for the takatak-v1 Cloud project; agency organization on the takatak.ca domain; OAuth consent screen verified for `business.manage` | Owner applies, dev prepares | 300 QPM visible in the Cloud console; organization exists |
| P0.9 | Questions sent to Clover DevRel ([RESEARCH_CLOVER.md](RESEARCH_CLOVER.md) open questions 1–8 and 12) | Owner sends from the developer account | Answers received and summarized in the PR |
| P0.10 | New Clover app created in **sandbox**: Web, App Market, Canada, FR-CA + EN-CA; name per D1; Site URL per D4 | Owner (dashboard), dev (values) | Sandbox App ID exists; draft `N4NYCJCZ17FF4` untouched |
| P0.11 | Fixes in takatak-v1 needed before any Clover merchant: (a) purge Google review copies older than 30 days; (b) no review gating in the public rating form and showcase: the same invitation, the same free-text prompt and the same "show my comment on the business's website" consent at **every** rating; the showcase lists all consented comments at any rating (newest first, with average and count), or none; the owner hides a comment only if unlawful, abusive or off-topic, with the reason logged; (c) data-deletion page shows one consistent address; (d) Meta data deletion callback | Dev (separate PRs) | Tests for each; for (b), a test that a consented 1★ comment appears in the showcase and that hiding needs a logged reason; PRs ready for owner merge |
| P0.12 | Hard block list and "own merchants" list defined (env names only in the repo) | Owner | Values set in Coolify, never in git |

## P1 — MVP: Clover install → TAKATAK workspace → Google + Facebook + Instagram

| # | Item | Acceptance check |
|---|---|---|
| P1.1 | Clover connector ported (OAuth v2, refresh lock, webhook gate, entitlement), gate off by default | Unit tests ported from Food Hub pass; with env unset, every Clover route answers 404 and nothing else changes |
| P1.2 | Install flow: `/clover/launch` → OAuth → workspace → onboarding pre-filled (FR first) | In the Clover sandbox: install → onboarding pre-filled with the sandbox merchant's name and address; the person signs in with the existing OTP |
| P1.3 | Clover read + normalized menu and hours (+ photo mapping screen). The raw Clover item name is kept in a source field with its detected language; for a Québec location every item needs a French name (typed by the merchant, or drafted by AI and approved) before the first menu push and before any new item syncs | Sandbox menu of 3+ categories shows in TAKATAK with correct prices in CAD; hidden items left out; test on modifier groups; **an English-only Clover menu for a QC location blocks sync and asks the merchant for French names** (test) |
| P1.4 | Channel consents (per channel, per data type, sync or approve-each), revocable. The signer gives name and title and confirms they may bind the business | Consent row stored with person, name, title, authority attestation, time, IP, text version; revoke stops queued jobs in a test; consent rows survive uninstall for the retention period (P1.12) |
| P1.5 | Publish queue + adapters, dry run by default | Dry run shows the exact API payload; no network call when `TAKATAK_PUBLISHING_LIVE` is off |
| P1.6 | Google adapter: info, regular and special hours, menu (`updateMask`, French `MenuLabel` with `languageCode` `fr`, English optional), photos, posts with ORDER button, Order online link (`MERCHANT`) | On a TAKATAK test location: price changed in Clover → Google menu read back with the new price; nothing else in the menu changed; labels read back with `languageCode` `fr` |
| P1.7 | Facebook adapter: posts and photos (only after P1.17 passes) | Approved post appears on a test Page; a post not approved is never sent (test) |
| P1.8 | Instagram adapter: posts (JPEG, public URL), after App Review of `instagram_business_content_publish` (only after P1.17 passes) | Approved post appears on a test account; container status handled; daily cap enforced |
| P1.9 | Approvals wired: draft → pending_approval → approved → scheduled → published / failed | Each transition in `AuditLog`; only allowed transitions (existing `canTransitionPost`) |
| P1.10 | Webhooks `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH` → re-sync | Changing hours in the sandbox queues one hours update, not a full re-push; out-of-stock never creates a post |
| P1.11 | Entitlement gate from `billing_info`; Stripe checkout hidden for Clover workspaces | Tests for trial, active, lapsed (read-only, restored on active), inactive; no Stripe button visible in a Clover workspace |
| P1.12 | Uninstall: notice, export, deletion after the window; consent records (signer, title, time, text version, scope, revocation) kept for the period the lawyer sets, as proof of mandate | Sandbox uninstall → tokens gone at once; data deleted after the window (test with a short window); consent records still present until their own retention date; audit entries present |
| P1.13 | Tenant isolation | `qa:tenant-isolation` extended with Clover cases, all pass |
| P1.14 | French first everywhere (screens, emails, errors, help) | Review of every screen in FR; EN available |
| P1.15 | Live pilot on TAKATAK's own real restaurants (never Po Poulet NDG), one channel at a time | Each channel published once for real and read back; no error in logs for 7 days |
| P1.16 | Repo checks | `npm run typecheck`, `npm run lint`, `npm test` (and the repo's QA scripts) green on each PR |
| P1.17 | AI draft guardrails (moved from P3: AI drafts are already in the P1 flow and the P1 listing). (a) Claim and word checks before approval: no "first/only/#1", no "24h", no "virtual/ghost", no invented discount, prices match Clover; (b) in-app disclosure "Texte proposé par l'IA — à valider"; (c) French by default for Québec merchants, French markedly predominant on bilingual posts (Charter s.58) | Blocking test cases pass for (a) and (c); disclosure visible in UI; **must pass before P1.7 and P1.8**. Fallback if not ready: AI drafting off for Clover-sourced workspaces and "drafted with AI" removed from the listing |
| P1.18 | AI provider allowlist for Clover-sourced workspaces: one or two named, contracted providers (DPA, no training on our data, retention limit, known region); reviewer names and contact data stripped before any AI call; separate consent for AI review replies | Test: a Clover workspace cannot route to a provider outside the allowlist; the AI payload of a review reply has no reviewer name, email or phone; providers listed in the privacy policy's sub-processor list and in the PIA (P0.4) |

## Clover submission checklist (after P1, and after first feedback on Food Hub or Phone AI)

- [ ] At least one channel works end to end in production; the listing names **only** working channels.
- [ ] App name (D1, final: an icon change after approval goes back to review; treat a name change the same), icon
      distinct from Food Hub and Phone AI, optional cover 1080×216.
- [ ] FR-CA and EN-CA tabs: tagline ≤255, 3–5 benefits ≤100, description with setup requirements (Google profile,
      Facebook Page, Instagram professional account, menu in Clover Inventory, photos uploaded in TAKATAK).
- [ ] Screenshots (web, ≤1920×1080), at least one functional and one vertical category.
- [ ] EULA and privacy policy URLs, written for this app, French first, matching the two permissions requested.
- [ ] Support site: FAQ, email, phone, hours; quick reference guide.
- [ ] Permissions: Merchant read + Inventory read, each with a justification.
- [ ] Webhook URL verified; events `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH`.
- [ ] Site URL and Alternate Launch Path on the final takatak.ca domain (same base domain).
- [ ] Pricing: 14-day trial, monthly tier(s), metered events (if any) — settled, in the right price currency, with the
      payout currency and bank account confirmed (DevRel answer to open question 5).
- [ ] Country: Canada; modules availability set (menu sync needs Items).
- [ ] Functional review video + description: install → pre-filled onboarding → connect Google → consent → preview →
      approve → publish → change a price in Clover → sync → uninstall.
- [ ] No Stripe, no ads, no cross-promotion inside the app; posts link to Clover online ordering.
- [ ] No "first", "only", partnership or endorsement claims ([MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md)); the hours
      benefit names only channels where hours sync works and says changes can take up to 48 h.
- [ ] P1.17 AI guardrails pass (claim and word checks, AI disclosure, French by default), or AI drafting is off and
      "drafted with AI" is not in the listing.
- [ ] Québec locations: every synced menu item has a French name (P1.3).
- [ ] SRM question answered by DevRel.
- [ ] Domain, permissions, languages, legal URLs, app name and icon frozen, and every subscription country added
      (after approval, these changes mean a new review; so does adding a first subscription country).

## P2 — More channels and multi-location

| # | Item | Acceptance check |
|---|---|---|
| P2.1 | Pinterest Pins (image + link to Clover ordering) | Pinterest Standard access granted; a Pin is publicly visible |
| P2.2 | Threads posts | App Review passed; post published |
| P2.3 | TikTok (video) | TikTok audit passed; post public |
| P2.4 | Facebook Page hours and info (if writable) | Read-back matches Clover |
| P2.5 | Google review replies for Clover merchants (approval-gated, opt-in auto-reply); AI drafts only through the P1.18 allowlist, with the separate AI review-reply consent | Reply posted only after approval or recorded opt-in; no AI call without that consent |
| P2.6 | Guided manual set-up for Apple Business Connect, Bing Places, Yelp (ready-to-paste text and photos) | Merchant checklist in FR and EN; no promise in the Clover listing |
| P2.7 | Several Clover merchants linked into one workspace (proof of control for each) | Tenant tests pass; unlinking works |
| P2.8 | Each new channel added to the Clover listing as a reviewed update | Clover approval of the update |

## P3 — AI content, with disclosure

| # | Item | Acceptance check |
|---|---|---|
| P3.1 | AI drafts for menu descriptions (FR, then EN) from Clover data only | No price, allergen or health claim that is not in merchant data (automated check) |
| P3.2 | Weekly post plan (drafts) per brand | All drafts land in `pending_approval` |
| P3.3 | Claim and word checks: moved to P1.17 (a) | — |
| P3.4 | Text disclosure moved to P1.17 (b). Still in P3: AI images (if ever allowed) labelled (`is_ai_generated` on Instagram) and never shown as real dishes | Flag set in API payloads |
| P3.5 | Optional auto-publish: explicit, recorded, revocable opt-in per channel; weekly summary email | Opt-in row exists before any auto post; revoke stops the next post |
| P3.6 | Metered AI events (only if decided in D5) | Sent exactly once per event; dry run until turned on |
| P3.7 | French by default on posts: moved to P1.17 (c) | — |

## Post-launch operations checklist (every year, from the first live Meta channel)

- [ ] A named Meta app admin watches the App Dashboard **Alert Inbox** and the admin email.
- [ ] Meta **Data Protection Assessment**: completed within the 60 days Meta gives (late, incomplete or vague answers
      can mean loss of platform access), every year it is requested.
- [ ] Meta **Data Use Checkup**: each permission's use certified every year.
- [ ] Answers match the privacy policy, the sub-processor list and agreements (P0.6, P1.18) and Platform Terms s.5.b.
- [ ] Clover: legal and privacy page changes sent to Clover first; Google: 30-day purge job still running.

## Not on this roadmap (on purpose)

- A TAKATAK public directory or marketplace fed by Clover data (Clover s.4.3, s.18): needs Clover's written OK or a
  separate merchant agreement on non-Clover data.
- Any plugin or code installed on Clover devices.
- Pushing menus to delivery marketplaces (Food Hub's job).
