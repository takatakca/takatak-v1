# takatak.ca order funnel — plan and status

Owner's brief of 2026-10-31 (relayed from the U-Haul reservation flow): one service leads to the next,
each step a page or pop-up with tiers, video, a running total, a quiet "No thanks", and a second chance.
Signed: Claude (cloud session upbeat-einstein).

## Built (branch `claude/upbeat-einstein-zqkf58`, PR #233)

| Brief | What exists | Where |
| --- | --- | --- |
| E. Upsell chain | `/commander`: business type → Website → Hosting (+ domain add-on) → Social → Marketing → Reviews (+ local listings add-on) → Phone (interest list, not launched) → AI credits → review | `src/components/website/funnel/OrderFunnel.tsx`, `src/lib/website/order-funnel.ts` |
| E. Tiers and badges | Real catalog tiers only; "Recommended" = the catalog's featured tier or our pick for the business type | same |
| E. Video pop-up | "See how it works" plays the step's 7 s clip | `public/media/social/` |
| E. Help | "How it works" (3 steps), live chat on every step | same |
| E. Running total | Cart counter that ticks up, first payment vs then per month / per year, quotes counted apart | same |
| E. Second chance | "No thanks" on a priced step offers the smallest tier once; no fake bundle discount | same |
| F. Business type | Asked first (skippable), pre-picks tiers: "For a restaurant, we recommend…" | `BUSINESS_PICKS` |
| G. Confirmation | Review page: edit/remove, FIRST10 saving, trust bar (true items only), Save this quote (shareable link), "Create my account and confirm" → `/register?plan=…` | same |
| A. Real deadlines | Promo codes can carry `endsAt`; the server refuses them after it; live countdown on the homepage, order sheet and review | `src/lib/promotions/catalog.ts`, `GET /api/promotions/active` |
| Homepage | "Added → pairs well with" chain, order sheet, FIRST10 saving, true badges | `src/components/website/funnel/` |

Tests: `npm run qa:order-funnel`, `npm run qa:promotions`.

## Not built yet (needs an owner decision or a key)

1. **A. Holiday landing pages** (Black Friday 27 Nov, Cyber Monday 30 Nov, Boxing Day 26 Dec 2026): need
   the % for each event, the services it covers, and the end time. Then one line per campaign in
   `src/lib/promotions/catalog.ts`; the countdown and landing page read it.
2. **B. Deal alerts + browser push**: needs VAPID keys (environment), a consent table, and the wording
   approved. Push permission is asked only after a "Yes" in our own pop-up, and it is never treated as
   email/SMS consent.
3. **C. Sign-up with Google**: exists in TAKATAK Auth? To confirm with the auth owner; email sign-up exists.
4. **D/G. Card pre-authorization and capture**: needs the processor decision (Stripe is used for social
   plans and AI credits; Upmind for domains/hosting). Rules we will follow: show the amount held and when it
   is charged; one click per add-on; never capture more than approved; show recurring price, frequency and
   how to cancel before confirmation. "Capture 1–2 h after the last add" needs the owner's written OK.
5. **H. Guarantee**: we show no guarantee until there is a written TAKATAK guarantee (like U-Haul's $50).
6. **Badges "Most popular" / "Client's choice"**: only once real order data backs them.
7. **Tier names S / M / L / Premium / VIP**: catalogs have 3–4 real tiers per service; renaming or adding
   VIP needs the owner's prices.

## Guardrails (Canada / Québec)

- CASL and Law 25: push, email and SMS each get their own unchecked opt-in, never bundled with sign-up or
  terms; unsubscribe in every message; proof of consent kept. No calls without express consent.
- No pre-checked paid add-ons ("Recommended" highlights instead).
- Discounts only off real regular prices; countdowns only for real deadlines (server-enforced).
- Trust claims only if true.
