# SmartLinks (Social)

A public link page per brand, for a social bio (Instagram, TikTok and others): a title, a short text and buttons to the brand's links. The dashboard shows visits and clicks for the last 30 days.

## Where

- **Dashboard:** `/dashboard/social/smartlinks` (Social menu → SmartLinks).
  - Viewing needs `view_social`.
  - Creating, editing, publishing and deleting need `manage_social_accounts`.
- **Public page:** `/l/<address>`.
  - Only published pages are shown. Any other address returns 404.
- **Button link:** `/l/<address>/go/<button>`.
  - It adds one to today's click count, then redirects to the link saved on that button.

## Rules

- **Address:**
  - 3 to 40 lower-case letters, digits or dashes. Accents are removed.
  - Reserved words such as `admin`, `api`, `dashboard`, `login` and `takatak` are refused.
- **Content limits:**
  - Title: up to 80 characters.
  - Short text: up to 240 characters.
  - Buttons: up to 20, each with a label of up to 60 characters.
- **Button links:**
  - Only absolute `https://` or `http://` links are accepted.
  - `javascript:`, `data:`, local addresses and links with a username or password are refused.
  - The redirect checks the saved link again. It never takes a target from the address bar, so there is no open redirect.
- **Publishing:** a page needs at least one button.
- **Scope:** every read and write is limited to the workspace and the active brand.

## Privacy

- The counters are daily totals per page (visits) and per button (clicks).
- No IP address, cookie or visitor identifier is stored.
- Prefetch requests are not counted as visits.

## Database

- **Migration:** `prisma/migrations/20261127070000_social_smartlinks`, which creates three tables:
  - `social_smartlinks`
  - `social_smartlink_buttons`
  - `social_smartlink_daily_stats`
- **Access:** RLS is enabled and access is revoked for `anon` and `authenticated`. Only the server reads these tables.
- **Not applied in production.** The owner approved the code on 2026-11-27, and applying the migration in production stays the owner's decision.
  - It is **not** on the production deploy list (`scripts/reconcile-production-migrations.mjs`).
  - Until it is applied, the dashboard says that SmartLinks is not activated yet.
  - The public pages return 404 and the API answers 503 with the same explanation. Nothing crashes.

## Checks

`npm run qa:social-smartlinks` (in CI) checks:
- address, link and limit rules;
- permissions and workspace and brand scoping in the API;
- no open redirect, and no visitor identifier stored;
- RLS on the three tables, and the migration kept off the production list;
- the editor in French and English, before and after activation, and the view-only mode.
