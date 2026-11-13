# TAKATAK-V1 vs Metricool: what the code shows (2026-11-10)

For issue [#281](https://github.com/takatakca/takatak-v1/issues/281), gates 2 and 5, **code evidence only**.
Read on `main` 7cc1c27c. Nothing was activated, billed, deployed or merged for this audit.

**The production column is "not checked" in every row.** This session has no access to the production environment,
the provider developer consoles or test accounts. "Built in code" never means "connected" or "live" (issue #281,
gate 3).

## Classes (gate 5)

| Class | Meaning |
|---|---|
| Shipped + verified | In `main` **and** proven in production with a real account. **No row can be put here from code alone.** |
| Code only | Built in `main`, not proven live. |
| Shell | A page or menu item exists, but no real data path behind it. |
| Third party | Needs an approval, review or paid tier from the provider before it can work. |
| Absent | Not in `main`. |

## 1. Providers (16 in `src/lib/social/providers/registry.ts`)

"Read" = data TAKATAK pulls from the provider. "Publish" = TAKATAK posting to the provider. "Sync" = a background
worker, not a page load.

| Provider | Connect | Token refresh | Read | Publish | Sync | Class | Production |
|---|---|---|---|---|---|---|---|
| Facebook Pages | OAuth PKCE (`callback/facebook`) | Long-lived token exchange (`meta-token.ts`) | Pages, page insights, content, demographics probe, competitors (`meta-pages`, `meta-insights`, `meta-content`, `meta-competitors`) | **Absent on `main`** (open PR #258, another agent) | Yes: `api/cron/social-sync-jobs` runs page sync + competitor workers | Code only | not checked |
| Instagram | Own Instagram Login + link through a Facebook Page (`instagram-token`, `meta-instagram`) | Long-lived token exchange; no refresh call found | Account identity only | Absent | No | Code only (connect); analytics absent | not checked |
| Threads | Own OAuth (`threads-token`) | Long-lived token exchange; no refresh call found | Account identity only | Absent | No | Code only (connect); analytics absent | not checked |
| YouTube | Google OAuth PKCE (`google-token`) | Yes | Channels, YouTube Analytics reports, video performance, competitors (`youtube-*`) | Absent | No | Code only | not checked |
| Google Business Profile | Google OAuth PKCE | Yes | Locations, performance, reviews, media, local posts (`google-business-*`) | Local posts: absent. Review replies: through QMAPS after approval (`src/lib/reputation/review-publisher.ts`) | No | Code only + third party (Business Profile API access) | not checked |
| LinkedIn | None (`implemented: false`, `connectable: false`) | — | — | — | — | Absent + third party (Community Management API) | — |
| TikTok | Login Kit PKCE (`tiktok-token`) | Yes | Account analytics + series (`tiktok-analytics*`) | Absent | No | Code only + third party (app review; Content Posting audit) | not checked |
| Pinterest | OAuth (`pinterest-token`) | Yes | **None** | Absent | No | Code only (connect only) | not checked |
| X | OAuth PKCE (`x-token`) | Refresh token stored; no refresh call found | Account identity only | Absent; a cost guard exists (`x-cost-control.ts`) | No | Code only (connect) + third party (paid API tier) | not checked |
| Bluesky | AT Protocol OAuth (`bluesky-oauth-*`, needs `BLUESKY_OAUTH_PRIVATE_JWK`) | Yes (library) | Analytics (`bluesky-analytics`) | Absent | No | Code only | not checked |
| Twitch | OAuth PKCE (`twitch-token`) | Yes | Community analytics, competitors (`twitch-*`) | Not applicable | No | Code only | not checked |
| Web | Homepage verification tag | — | GA4 + Search Console through a service account (`src/lib/integrations/google/client.ts`) | — | No | Code only | not checked |
| Blog | Needs a connected website | — | — | TAKATAK blog page | — | Code only | not checked |
| Meta Ads | OAuth PKCE (`meta-ads-*`) | Long-lived | Ad accounts + account insights | Campaign create/edit: absent | No | Code only (read) + third party (`ads_read` review) | not checked |
| Google Ads | Google OAuth PKCE (`google-ads-*`) | Yes | Ad account list only; no metrics | Absent | No | Code only + third party (developer token) | not checked |
| Looker Studio | Google OAuth PKCE (`looker-studio-*`) | Yes | Lists the client's reports, opens a report link | — | No | Code only; **a Looker Studio connector (TAKATAK data inside Looker) is absent** | not checked |

Readiness (`getSocialProviderReadiness`) only checks that the server variables are present: `not_configured` or
`ready_for_authorization`. Neither one means an account is connected.

## 2. Metricool features

| Metricool feature | What `main` has | Class | Evidence |
|---|---|---|---|
| Connect accounts | 15 of 16 providers can start a connection; LinkedIn cannot | Code only | Table 1 |
| Publish to networks | No publishing call to any provider on `main`. Facebook publishing is in open PR #258. The Metricool adapter only writes `planned` job records | Absent | `src/lib/integrations/metricool/metricool-jobs.ts` |
| Planner / calendar | Calendar reads the brand's `SocialPost` rows; posts are created only as drafts from the AI hand-off. No worker sends them | Code only (view); scheduler absent | `src/lib/social/planning/planning-data.ts`, `src/lib/ai/handoff.ts` |
| Queues, best time to post | — | Absent | — |
| Content library / AI | AI hand-off to draft posts; picture proxies for Facebook and Business Profile | Code only | `src/lib/ai/handoff.ts`, `src/lib/social/media/` |
| Unified inbox | Page exists; data always returns `threads: []` | Shell | `src/lib/social/inbox/inbox-data.ts` |
| Saved replies (social) | — | Absent | — |
| Comment-to-DM | — | Absent | — |
| Social analytics | Facebook, YouTube, Business Profile, TikTok, Twitch, Bluesky, Meta Ads. Not Instagram, Threads, Pinterest, X, LinkedIn, Google Ads | Code only (7 of 16) | `api/social/*/analytics` |
| Website analytics | GA4 + Search Console, read-only, for verified sites | Code only | `src/lib/integrations/google/client.ts` |
| Competitors | Facebook, YouTube, Twitch | Code only | `meta-competitors`, `youtube-competitors`, `twitch-competitors` |
| Hashtag monitoring | Only in AI prompts | Absent | — |
| Ads: create / read / optimize | Read Meta Ads insights; list Google Ads accounts. "Ads" menu item is disabled (`enabled: false`). TikTok Ads absent | Code only (read); create/optimize absent | `social-workspace-shell.tsx` |
| TAKATAK ADS (own network) | Separate product, foundation / pilot; CPM/CPL billing not complete | Code only | `docs/TAKATAK_ADS_FOUNDATION.md` |
| Listings and reviews | Business Profile read; review replies through QMAPS after approval; local-listings data falls back to mock data **only in local demo mode** (client accounts get `allowMockFallback: false`) | Code only | `src/lib/local-listings/local-listings-data.ts`, `src/lib/security/data-scope.ts` |
| SmartLinks | Menu item disabled (`enabled: false`), no page | Absent | `social-workspace-shell.tsx` |
| PDF / PPT reports | Reports page says "Export to PDF or PPT when the builder is ready"; no export code | Shell | `src/components/social/reports/social-reporting-view.tsx` |
| Looker Studio connector | Only lists and opens the client's own reports | Absent | Table 1 |
| Cross-brand dashboards | Brand switcher and per-brand data; no roll-up across brands found | Code only (per brand) | `src/lib/security/brand-context.ts` |
| Teams, roles, approvals | Workspace roles and permissions, invitations, approvals in "My tasks" | Code only | `src/lib/security/roles.ts`, `src/lib/team/`, `src/lib/social/my-tasks-data.ts` |
| Public API / automations | `/api/v1` covers identity, OTP, events, merchant entitlements; no social API. Automations live in `takatak-automate` (not read here) | Absent (social) | `src/app/api/v1/` |
| Mobile | Responsive pages; no web app manifest | Absent (app) | no `manifest` in `src/app` or `public` |
| Social plans billing | Stripe plans and add-ons in code; **CAD prices are placeholders** | Code only; prices need the owner | `src/lib/billing/SOCIAL_PAYMENT.md` |
| Metricool as a provider | Admin "test connection" only; no guessed endpoints | Code only (test) | `src/lib/integrations/metricool/client.ts` |

## 3. Words in the dashboard that promise more than the code does

Not changed here, so that this pull request stays documentation-only. Listed so the next change can fix them:

- `registry.ts`: Pinterest is described as "boards, Pins, publishing, and analytics". Only the connection is built. This
  text is shown in the connections window (`src/app/dashboard/social/layout.tsx`).
- `dashboard/social/[platform]`: the Instagram, Threads, X and Pinterest pages describe analytics ("Understand your
  Instagram audience…", "Analyze Pinterest profile, board and pin performance."). None of the four reads analytics.
  The Instagram page also says "Connect your accounts to unlock analytics, scheduling and content…"; scheduling is not
  built either.
- The fallback page tells a Pinterest user to connect "before analytics can be displayed". Once connected, nothing more
  will be displayed.

## 4. Gate 3 repairs: what the code shows

| Item in #281 | Code on `main` | Still needed |
|---|---|---|
| LinkedIn | Nothing beyond the registry entry | OAuth module + LinkedIn app approval (owner) |
| Facebook Page sync / worker / cron | Worker and cron route exist | Proof that the cron runs in production |
| TikTok review | Login Kit + analytics built | TikTok app review (owner) |
| Twitch redirect origin | `TWITCH_OAUTH_REDIRECT_URI`, else the app origin + callback path (`twitch-oauth.ts`) | Exact redirect registered in the Twitch console (owner) |
| YouTube verification | Read scopes only | Google OAuth app verification (owner) |
| Meta / Google Ads access | Read-only, account level | Meta `ads_read` review; Google Ads developer token (owner) |
| Business Profile live locations | Location list built | Business Profile API access + a real location (owner) |
| X budget safeguards | Cost guard module, no publishing yet | Paid tier decision (owner) |

## 5. Order of work proposed (gate 5 priorities)

1. **Connection reliability (needs the owner):** for each provider, are the variables set in production, is the app
   approved, does a test account connect? This fills the production column above.
2. **Scheduler and analytics:** finish and merge Facebook publishing (PR #258, its own agent), add a worker that sends
   approved posts at their time, then add reads for Instagram and Threads.
3. **Words:** fix the promises in section 3. Small and needs no access.
4. **Ads, listings, reporting:** Google Ads metrics, a PDF export for reports.
5. **Inbox, comment-to-DM, SmartLinks:** last, as the issue says.

Not read for this audit: open PR branches (only their titles), the `takatak-automate` repository, production.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-10 09:51 UTC
