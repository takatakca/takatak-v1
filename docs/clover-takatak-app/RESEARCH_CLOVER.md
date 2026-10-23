# Research: Clover rules for a third App Market app (TAKATAK)

Read on 2026-10-23. Research only. **Not legal advice.**

How to read this file:
- **FACT** = what a dated source says (URL and read date given).
- **INFERENCE** = our reading of what it means for TAKATAK. To be confirmed with Clover Developer Relations (DevRel) or a
  lawyer when marked.

Context: two TAKATAK apps were submitted to Clover on 2026-10-17 and are pending review: **TAKATAK Food Hub**
(`629HFYHNVMZYR`) and **TAKATAK Phone AI** (`20FK28P20HJC6`). The same developer account holds an empty draft app
"on2go" (`N4NYCJCZ17FF4`).

## Bottom line (INFERENCE)

A Clover **web app** that reads a merchant's Clover menu and hours, and publishes them **at that merchant's direction**
to the merchant's own Google, Facebook, Instagram and Pinterest accounts, looks allowed under Clover's rules if four
conditions hold:

1. **Clover billing only.** Everything a Clover merchant pays for the TAKATAK app's features goes through Clover:
   subscription, add-ons, AI credits, upgrades. Clover keeps 30%. No Stripe checkout and no feature unlocking on
   takatak.ca for these merchants.
2. **One merchant, one app.** Data from Clover serves only the merchant who installed the app, inside this app. It is not
   shared with Food Hub or Phone AI, not used in QMAPS or a TAKATAK directory or marketplace, not used for TAKATAK's own
   marketing, and it is deleted on uninstall.
3. **Merchant in control.** The merchant consents to each channel in the app, and previews and approves every post.
4. **A real web app on our domain.** OAuth v2 expiring tokens, minimal permissions (Merchant read, Inventory read),
   French and English for Québec, a privacy policy and EULA written for this app (not generic).

The "master platform / plugin marketplace" idea collides with three Clover rules: the ban on plug-in architectures, the
ban on using Clover data in another marketplace or in offerings that compete with the App Market, and the ban on
advertising services that compete with Clover's. So Clover-sourced data and features stay **inside** the TAKATAK Clover
app. The slogan "the first AI backend" is an unproven superlative: keep it out of the listing (see
[MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md)).

## Sources read (2026-10-23)

| Source | URL | Version shown |
|---|---|---|
| Clover App Market Developer Terms | https://www.clover.com/developer-agreement | effective 2025-02-20 (Part IV = Canada) |
| Developer Program Policies | https://www.clover.com/app-market-policies | last updated 2025-01-01 |
| Privacy policy template | https://docs.clover.com/dev/docs/clover-privacy-policy-template | — |
| App approval | https://docs.clover.com/docs/developer-app-approval | — |
| Approval and App Market FAQ | https://docs.clover.com/dev/docs/app-approval-and-app-market-faqs | — |
| Web app basics | https://docs.clover.com/dev/docs/clover-development-basics-web-app | updated 2026-09-30 |
| Merchant onboarding | https://docs.clover.com/dev/docs/app-onboarding-for-merchants | — |
| App design requirements | https://docs.clover.com/dev/docs/app-design-requirements | — |
| Expiring tokens | https://docs.clover.com/dev/docs/expiring-tokens-required-in-all-regions | — |
| High-trust auth flow | https://docs.clover.com/docs/high-trust-app-auth-flow | — |
| OAuth | https://docs.clover.com/dev/docs/use-oauth | — |
| App settings (GDP) | https://docs.clover.com/dev/docs/gdp-manage-app-settings | — |
| Create a new app (GDP) | https://docs.clover.com/dev/docs/gdp-create-new-app | — |
| Revising approved apps | https://docs.clover.com/dev/docs/draft_revising-and-reviewing-approved-or-published-apps | — |
| Permissions | https://docs.clover.com/docs/permissions | — |
| Opening hours API | https://docs.clover.com/dev/reference/merchantgetallmerchantopeninghours.md | — |
| Item API | https://docs.clover.com/dev/reference/inventorygetitem.md | — |
| Webhooks | https://docs.clover.com/docs/webhooks | — |
| Inventory webhook changes | https://docs.clover.com/dev/docs/upcoming-changes-to-inventory-webhooks | updated 2026-09-28 |
| Pricing tiers (GDP) | https://docs.clover.com/dev/docs/gdp-set-up-pricing-tiers | — |
| Monetizing apps | https://docs.clover.com/docs/monetizing-your-apps | — |
| Billing for apps | https://docs.clover.com/docs/billing-for-apps | — |
| Multiple markets | https://docs.clover.com/dev/docs/multiple-markets | — |
| International readiness | https://docs.clover.com/docs/international-app-market-readiness | — |
| Canadian merchants | https://docs.clover.com/dev/docs/canadian-merchants | — |
| Listing (GDP) | https://docs.clover.com/dev/docs/gdp-set-clover-app-market-listing | — |
| Managing app details | https://docs.clover.com/dev/docs/managing-app-details | — |
| Admin checklist | https://docs.clover.com/dev/docs/app-administration-checklist | updated 2026-07-08 |
| Private apps | https://docs.clover.com/dev/docs/gdp-work-with-private-apps | updated 2026-07-08 |
| Local Inventory by Google (precedent) | https://support.google.com/pointy/answer/10000373 | — |
| Charter of the French language | https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11 | current to 2026-08-12 |
| Competition Bureau, misleading representations | https://competition-bureau.canada.ca/en/deceptive-marketing-practices/types-deceptive-marketing-practices/false-or-misleading-representations | — |
| Repo note | foodhubca `docs/CLOVER_MULTI_APP.md` (origin/main b40e446) | — |

## Findings

### 1. Billing must go through Clover, add-ons included

- **FACT.** Developer Terms s.8.2: "All App Fees must be collected and processed via the App Market." s.9.1: revenue from
  installed apps (subscriptions, in-app features, add-ons, extras) carries the Transaction Fee. s.9.2: the fee is 30% of
  net revenue; Clover may also charge a Distribution Fee on free installs. s.17.3: Clover may audit and recover underpaid
  amounts and audit costs if billing goes around the App Market.
- **INFERENCE.** A merchant who installed the TAKATAK Clover app cannot be sent to takatak.ca Stripe plans (social
  plans, Growth add-ons, AI credits) for this app's features. Charge through Clover subscription tiers and/or metered
  events. Turn off the takatak-v1 Stripe paywalls for any workspace that came from Clover.

### 2. No unlocking features outside the App Market; no ads inside the app

- **FACT.** Developer Program Policies (Functionality, App Purchase): an app may not unlock or enable features "through
  any distribution mechanisms other than the App Market"; paid in-app content must use App Market payments. The
  Advertisement Policy forbids ads or promotions inside an app.
- **INFERENCE.** No upsell of takatak.ca-only paid modules inside the Clover experience. No banners for other TAKATAK
  products (Food Hub, Phone AI, others) unless Clover confirms that linking to our own App Market listings is fine.

### 3. Plug-in architectures are banned

- **FACT.** Policies: an app may not install or launch other executable code by any means, "including through a plug-in
  architecture", and may not lead users to install apps from outside the App Market without knowing it.
- **INFERENCE.** Do not present the Clover app as a "plugin host" or "plugin marketplace". Present it as a web app (REST
  + OAuth) with a fixed, reviewed feature set. takatak.ca "plugins" must not be reachable as paid or unlockable extras
  for Clover-sourced merchants.

### 4. Merchant data: only for the installing merchant, never in another marketplace

- **FACT.** Developer Terms:
  - s.4.3: data collected through installed apps must not be used in any other marketplace or in offerings that compete
    with the App Market;
  - s.18.1: the developer acts as the merchant's service provider or processor;
  - s.18.2: User Data and customer information may be used only to provide the app to the merchant that installed it;
  - s.18.4: use only for the purposes the merchant consented to; no selling, disclosing or sharing with third parties
    except as the Terms allow; service providers bound by similar limits;
  - s.18.6: keep data only as long as needed; permanently delete it when the merchant uninstalls, after a reasonable
    window to export it.
- **INFERENCE.**
  - Food Hub, Phone AI and TAKATAK each have their own OAuth token, permissions and data store. TAKATAK features are
    never fed from Food Hub's Clover tokens or menu cache.
  - Clover-sourced data never goes into QMAPS, a TAKATAK public directory, a marketplace of other businesses, or
    TAKATAK's own marketing, unless Clover agrees in writing or the merchant gives that data separately, outside Clover.
  - Clover merchants can be mapped in takatak-v1 as `SourceMerchant` with `sourceApplication = "clover"`, but scoped to
    that merchant only. Do not merge them into a cross-app `MasterMerchant` identity without the merchant's explicit
    choice.
  - Build an uninstall flow on the App (`A`) webhook: export window, then deletion.
- **Related, existing apps (INFERENCE, to check with DevRel).** foodhubca `docs/CLOVER_MULTI_APP.md` says phone features
  use "the phone token first, then Food Hub's". Under s.18.2 that fallback may count as one app's data serving another
  app. Not part of this task; flagged so the owner can ask DevRel in the same message.

### 5. Publishing menus and hours to Google, Meta and Pinterest at the merchant's direction

- **FACT.** Clover's privacy policy template lists, among allowed recipients, "With third parties as a Merchant may
  direct". Developer Terms s.18.3: tell merchants clearly and conspicuously that their data will be accessed. Part IV
  s.5.2 (Canada): the merchant's authorization in the app agreement is needed to receive personal data.
- **FACT (precedent).** Google's help describes "Local Inventory by Google" as a free Clover App Market app that adds
  products to the merchant's Google Business Profile.
- **INFERENCE.** Pushing data to Google Business Profile, Facebook, Instagram and Pinterest fits Clover's model if it is
  clearly merchant-directed:
  - consent in the app, per channel and per data type (menu, prices, hours, photos, posts), recorded with who and when;
  - each recipient platform named in the privacy policy and EULA;
  - the merchant is told that content already published stays on their own accounts after uninstall, under their
    control.
  Menu and hours are mostly business data, not personal data. That lowers the privacy-law stakes, not the contract
  limits.

### 6. Messages on the merchant's behalf need confirmation

- **FACT.** Policies (Spam and Placement): no SMS, email or other messages on a user's behalf unless the user can confirm
  the content and the recipient. App design requirements: apps that send marketing messages show a preview, allow
  reasonable customization and honour opt-outs.
- **INFERENCE.** Fully autonomous AI posting is a review risk. Default to the existing takatak-v1 status machine (draft →
  pending_approval → approved → scheduled → published) with preview and edit. Auto-publish only as an explicit, recorded,
  revocable opt-in.

### 7. A gateway to our own platform is fine if it is a real app we own

- **FACT.** Web app guidance: web apps let merchants connect services through a central hub, redirected from the Merchant
  Dashboard to the developer's site. The app URL must start the login flow, not land on a general homepage. Policies ban
  apps whose main purpose is affiliate traffic, or a web view of a site the developer does not own. Onboarding checklist:
  the app "does not enforce any usage restrictions", sign-up forms are pre-filled from `/v3/merchants`, any extra setup
  is stated upfront.
- **INFERENCE.** takatak.ca can be the front end. The Site URL lands on a Clover-OAuth login or pre-filled onboarding
  page, not the marketing home. The app works for any Clover merchant, not only TAKATAK brands, and needs no separate
  paid takatak.ca plan. The listing says that Google, Meta or Pinterest accounts are needed per channel.

### 8. Do not promote services that compete with Clover

- **FACT.** Developer Terms s.2.4: no advertising to merchants of products or services that compete with Clover's or
  its affiliates'. Policies: payments on non-Clover devices are prohibited functionality. Approval page: another payment
  processor is a rejection reason.
- **INFERENCE.** The app and its posts do not push Clover merchants toward Stripe Connect invoicing, non-Clover online
  ordering or payment links, or other POS tools. Default call-to-action = the merchant's own Clover online ordering. This
  fits the owner's "Clover order link first" rule.

### 9. Approval review

- **FACT.** Three parts: functional (workflow video and description, permission justifications, REST setup, webhooks),
  legal (privacy policy and terms match the permissions and are "NOT a generic version"), listing (complete, distinctive
  icon you own). Statuses: Draft, Pending, Under Review, Changes Required, Withdrawn, Approved, Published, Rejected,
  Denied. Rejection causes include repeated functional failures, a video that does not show full functionality,
  unjustified permissions, legal gaps, an incomplete listing, another payment processor, and not answering Clover.
  Clover may refuse an app at its discretion.
- **INFERENCE.** Reuse the Food Hub review package pattern (bilingual legal pages, support page, reviewer test path) but
  write TAKATAK-specific privacy and EULA text covering social and listing publishing and AI-written content.

### 10. Review timelines

- **FACT.** FAQ: timelines vary; for long waits, write to DevRel with the App ID (address in the FAQ); code freezes slow
  answers; reply on the rejection thread to get reasons. No published SLA.
- **UNCONFIRMED.** A community forum report (seen in search) of about 10 weeks before rejections. community.clover.com
  did not resolve on 2026-10-23, so it was not checked.
- **INFERENCE.** Six days pending is normal. Nothing found forbids a third submission while two are pending. Build and
  test in sandbox now; submit after the first feedback on Food Hub or Phone AI so the legal lessons carry over.

### 11. OAuth v2 with expiring tokens (required)

- **FACT.** All regions must use expiring tokens; North American apps had to move to v2 by 2025-03-31. High-trust flow:
  `GET /oauth/v2/authorize` → redirect with `merchant_id`, `client_id`, `code` → `POST /oauth/v2/token` with the client
  secret. Refresh tokens are single-use (`/oauth/v2/refresh`). A recovery token lasts up to 2 weeks; after that the
  merchant redoes OAuth. North America: `www.clover.com` to authorize, `api.clover.com` for the API. The Alternate Launch
  Path must share the Site URL's base domain.
- **INFERENCE.** takatak-v1 needs a Clover connector: encrypted token pair per merchant (reuse the `SocialCredential`
  crypto), a refresh lock because refresh tokens are single-use, and a final Site URL and launch path on takatak.ca
  before submission (a Site URL change after approval is reviewed again). foodhubca `lib/foodhub/pos/clover-oauth.ts`
  already solves this per (app, merchant) and is the code to port.

### 12. Permissions and data for a menu, hours and posts app

- **FACT.** Inventory read covers items, categories, discounts, modifier groups. Merchant read covers basic properties
  and address; hours come from `GET /v3/merchants/{mId}/opening_hours`. Request only what you need, with a justification
  reviewers check. A permission change after install applies only after uninstall and reinstall. Some healthcare MCCs
  cannot install apps that read customers or inventory.
- **FACT (weak).** The item API shows only a `menuItem.imageFilename` field; a community answer said product images are
  not exposed to third parties. Not confirmed for 2026.
- **INFERENCE.** Ask only for **Merchant read** and **Inventory read**. No Customers, Orders, Payments or Employees.
  Freeze permissions before launch. Photos are uploaded or chosen in TAKATAK, mapped by Clover item ID.

### 13. Webhooks

- **FACT.** One HTTPS callback per app, verified with a code Clover sends; each message carries `X-Clover-Auth`.
  Payloads hold IDs plus CREATE / UPDATE / DELETE, so details must be fetched. Types: `A` (install, uninstall,
  subscription; needs Merchant read), `I`, `IC`, `IG`, `IM` (inventory), `M` (merchant), `SH` (service hours). Clover is
  splitting the Item webhook into `I`, `IS` (stock) and `IA` (availability); `IS` and `IA` carry data in the payload.
- **INFERENCE.** Subscribe to `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH`. Use them to re-sync menus and hours and to run
  uninstall. Treat `IA` carefully: an item going out of stock must never trigger a public post.

### 14. Pricing, trials, currency

- **FACT.** Fee types: monthly subscription, metered (pay per action), tiers plus metered, or free (Terms s.8.1). At least
  one subscription country, even if free. GDP trial options: 14, 30, 60 or 90 days. Subscriptions billed monthly in
  advance, prorated; metered billed in arrears via `POST /v3/apps/{appId}/merchants/{mId}/metereds/{meteredId}`. Changing
  a metered price after approval needs a DevRel request. Price changes do not apply to existing installs (s.4.1).
  Developer gets 70%. `billing_info` returns status (Active, Lapsed, Inactive, Suppressed) and `isInTrial`; features may
  be limited for lapsed merchants but must come back when payment resumes.
- **FACT (conflict).** The international page says "App prices are set in US dollars (USD)"; the pricing page shows
  per-country prices in local currency.
- **INFERENCE.** Mirror the owner's pattern: 14-day trial, then CAD $50/month base tier. Optional metered events (for
  example an extra brand profile). Settle metered prices before approval. Confirm CAD with DevRel.

### 15. Canada and Québec requirements (Clover)

- **FACT.** Canadian launch page: EULA that accounts for Canadian rules; privacy policy addressing PIPEDA; localized
  listing; for Québec merchants every merchant- and customer-facing screen "available in French and English"; Revenu
  Québec SRM certification for apps in hospitality and restaurant sectors. Developer Terms Part IV: operator Clover
  Network LLC; Clover processes non-US app fees; remittance in the collected currency; agreement in English by choice;
  Ontario law, Toronto courts. Canadian merchant plans: two Clover pages list different plans (conflict).
- **INFERENCE.** French-first screens, emails, onboarding and listing, plus English. SRM targets systems that record
  sales and print bills; a listings and marketing app should be out of scope, but ask DevRel (already an open question
  for Food Hub). Use the Modules setting, or state that menu sync needs the Items module.

### 16. Charter of the French language (law)

- **FACT** (LégisQuébec, current to 2026-08-12): s.51 product inscriptions in French, "This rule applies also to menus
  and wine lists"; s.52 catalogues and brochures in French, any medium; s.52.1 software available in French; s.55 a
  contract of adhesion binds in another language only if the French version was given first and the party expressly
  chose otherwise; s.58 commercial advertising in French, or bilingual with French markedly predominant.
- **INFERENCE.** EULA shown in French first. App UI in French. Menus, posts and ads for Québec restaurants default to
  French or French-predominant bilingual. Details in [LEGAL_QUEBEC_CANADA.md](LEGAL_QUEBEC_CANADA.md).

### 17. Listing assets and naming

- **FACT.** Name unique, editable, no "Clover" (also not in the website name or support email domain). Icon 1:1 PNG,
  distinctive, no Clover or Fiserv marks; once uploaded it can be replaced, not deleted. Optional cover 1080×216 PNG.
  3–5 benefits of up to 100 characters; tagline up to 255; description. Web screenshots min 320 px, up to 1920×1080.
  Optional listing video (YouTube or Vimeo); a separate functional review video and description at submission. EULA and
  privacy URLs; support phone, hours, email, website with FAQ; at least one functional and one vertical category; one
  language tab per language and country. Policies: a "quick reference guide" and accurate disclosure of permissions.
- **INFERENCE.** Icon clearly distinct from Food Hub and Phone AI. FR-CA and EN-CA tabs. A takatak.ca support, FAQ and
  legal hub. A reviewer video: install → pre-filled onboarding → connect Google Business Profile → preview a post →
  approve → publish → uninstall.

### 18. Several apps on one developer account; links and bundles

- **FACT.** Clover "may limit the number of Developer Accounts"; no limit on apps per account found. Each app has its own
  App ID, secret, pricing, webhook URL and listing. The admin checklist asks the description to state extra
  requirements, "including another app or hardware". No bundle or cross-app discount feature found. Private apps are
  shared by link and "not billable using the App Market billing process".
- **INFERENCE.** A third public app is fine. Make TAKATAK fully standalone. No bundle discounts outside Clover billing. A
  private app could serve TAKATAK's own restaurants for testing while the public one is reviewed.

### 19. Reuse the draft "on2go" (`N4NYCJCZ17FF4`) or create a new app

- **FACT.** On the Global Developer Platform the name, app type and permissions are editable; countries, languages and
  category are set at creation; re-review rules apply only to approved or published apps. foodhubca
  `docs/CLOVER_MULTI_APP.md` chose earlier not to reuse this "Android & Web" draft.
- **INFERENCE.** Reuse brings no benefit and adds risk (Android flag may add APK tasks; wrong country or category; legacy
  vs global platform unknown). Create a new **Web, App Market, Canada, FR-CA + EN-CA** app. Leave the draft for a future
  ON2GO device app.

### 20. The slogan "the first AI backend, all connected"

- **FACT.** Policies: descriptions must not mislead. Terms s.13.1: listing information true and accurate; s.3.6: evidence
  for claims of third-party certification. Competition Bureau: claims judged on literal meaning and general impression;
  false or misleading claims are prohibited whether or not anyone was misled.
- **INFERENCE.** Do not use "first" in the listing or ads. See [MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md).

## Requirements for the TAKATAK Clover app

1. New app on the Global Developer Dashboard: App Market, **Web only**, Canada, FR-CA + EN-CA, no "Clover" in the name,
   icon distinct from Food Hub and Phone AI. Do not reuse `N4NYCJCZ17FF4`.
2. Clover billing only: free trial (owner pattern 14 days), monthly tiers, optional metered events, all settled before
   approval. No Stripe, AI credits or add-ons on takatak.ca for this app's features.
3. Feature gate from `GET /v3/apps/{appId}/merchants/{mId}/billing_info`; limit features when Lapsed or Inactive;
   restore promptly when payment resumes. Metered events via `POST .../metereds/{meteredId}`.
4. OAuth v2 high-trust flow; encrypted token pair per merchant; serialized refresh; re-auth after 2 weeks of failure.
   Site URL and Alternate Launch Path on the final takatak.ca domain before submission.
5. Permissions: Merchant read + Inventory read, with inline justification. Nothing else.
6. Webhook on takatak.ca: HTTPS, verified, `X-Clover-Auth` checked; events `A`, `I`, `IC`, `IG`, `IM`, `M`, `SH`.
7. Uninstall (`A`): export window, then permanent deletion of Clover-sourced data; tell the merchant what stays on their
   own accounts.
8. Per-app data separation: own token and store; no Food Hub or Phone AI data; no QMAPS, directory, marketplace or
   TAKATAK marketing use.
9. Consent per channel and per data type, recorded; preview and approval before each publish; auto-publish only as an
   explicit revocable opt-in.
10. Onboarding pre-filled from `/v3/merchants`; works for any Clover merchant; needed third-party accounts stated
    upfront.
11. Every screen, email, error and the EULA in French and English, French first; the generator defaults to French for
    Québec merchants.
12. App-specific privacy policy (PIPEDA, Québec Law 25, recipients "as the merchant directs" naming Google, Meta,
    Pinterest; sub-processors incl. AI provider and database region; retention and deletion on uninstall; effective
    date) and EULA (TAKATAK as licensor, Clover not a party, Clover-billing-only fees, Canadian law). Later changes go to
    Clover first.
13. Listing package: tagline ≤255, 3–5 benefits ≤100, description with setup requirements, screenshots, categories,
    support site, quick reference guide, functional review video.
14. Posts and links never promote non-Clover payment or ordering tools; Clover online ordering link first.
15. No unproven superlatives, no suggestion of Clover endorsement; follow Clover brand guidelines for any mention.

## Risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Hybrid billing: takatak.ca sells Stripe plans. Charging a Clover-sourced merchant through Stripe for this app's features breaches s.8.2, s.9.1 and the unlocking rule; an audit (s.17.3) can lead to removal. | Blocker | Tag Clover workspaces (`sourceApplication = clover`); turn off Stripe checkout for them; entitlements from `billing_info`. Ask Clover in writing how to treat a merchant who was already a Stripe customer. |
| 2 | "Master platform / plugin marketplace": Clover data in a TAKATAK marketplace, QMAPS, a directory or TAKATAK promotion conflicts with s.4.3, s.18.2, s.18.4; "plugin" wording conflicts with the plug-in ban. | High | Hard boundary: Clover data serves only the installing merchant inside this app. Directory or marketplace listings only from a separate merchant agreement on non-Clover data, or Clover's written OK. Describe a fixed-feature web app. |
| 3 | Cross-app reuse between Food Hub, Phone AI and TAKATAK (e.g. TAKATAK built on Food Hub's tokens or menu cache). | High | Separate tokens, permissions and stores per App ID. Shared data only if the merchant installs and consents to each app. |
| 4 | AI posts published without confirmation fail the functional review. | High | Approval workflow by default, shown in the review video; auto-publish only as a recorded opt-in. |
| 5 | Channels not yet working: Google Business Profile API access pending; Instagram publish scope and Pinterest Pin creation not built. A listing that promises what does not work is a rejection cause. | High | Submit only when at least one channel works end to end in production. List only working channels; add others as reviewed updates. |
| 6 | Québec French: English-first EULA, untranslated screens, English-only posts. | Medium | French-first UI, legal pages, listing; French EULA shown first; generator defaults to French; lawyer review. |
| 7 | Changing Site URL, permissions, languages, legal links or countries after approval sends the app back to review. | Medium | Freeze domain, permissions, languages, countries and legal URLs before first submission. |
| 8 | Review delays; legal mistakes repeated across three apps. | Medium | Sandbox now; submit after first feedback on the two pending apps; answer Clover fast. |
| 9 | Promoting Stripe invoicing, non-Clover ordering or other TAKATAK services inside the app (s.2.4, ad ban). | Medium | No cross-promotion; Clover online ordering in posts; ask DevRel about links to our other listings. |
| 10 | Item photos may not be available from the Clover API. | Low | Upload or pick photos in TAKATAK, mapped by Clover item ID; ask DevRel. |
| 11 | "First AI backend" in the listing (misleading-description rule, Competition Act). | Low | Factual feature description only. |
| 12 | Terms s.3.7 asks developers to capture app users' IP addresses and send them to Clover, and to use CAPTCHA on payment pages; scope unclear for a non-payment app. | Low | Log app users' IPs (the `AuditLog` table has an `ipAddress` column); ask DevRel what to send. |

## Open questions (for Clover DevRel unless noted)

1. A merchant already paying TAKATAK through Stripe installs the Clover app: must all TAKATAK fees move to Clover, or only
   the features that depend on Clover data?
2. Is merchant-directed publishing of Clover inventory, hours and merchant data to Google Business Profile, Facebook,
   Instagram and Pinterest acceptable under s.18.4? Preferred consent wording? (Precedent: Local Inventory by Google.)
3. May the TAKATAK app mention or link to our other App Market apps, or does the Advertisement Policy forbid it? Any
   bundle or cross-app discount mechanism?
4. Does Revenu Québec SRM certification apply to a marketing and listings app that records no sales?
5. Can Canadian prices be set in CAD on the Global Developer Platform?
6. Owner to check in the dashboard: is draft `N4NYCJCZ17FF4` on the legacy or the global platform, and where do the two
   pending apps sit?
7. Is there a current API to read item photos beyond `menuItem.imageFilename`?
8. What does s.3.7 (capture and transfer user IP addresses) require for a non-payment web app?
9. (Google, Meta) Which channel will work end to end at submission time? See the Google and Meta files.
10. (Lawyer) Law 25 transfers outside Québec: takatak-v1's database is in `eu-west-1` (Ireland). PIA and privacy officer
    needed.
11. (Owner) Final Site URL: `takatak.ca/...` path or a subdomain such as `app.takatak.ca`? Must be final before
    submission.
12. (Existing apps) Is the Phone AI app's fallback to Food Hub's token acceptable under s.18.2 when a merchant has both
    apps?
