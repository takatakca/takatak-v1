# TAKATAK V1 — Decisions and Invariants

Updated 2026-10-14. Distinguish **owner decisions** from agent implementation choices. Source decisions in [WORKLOG.md](../WORKLOG.md), [DEV-TODO.md](DEV-TODO.md), [AGENTS.md](../AGENTS.md), and architecture runbooks; do not independently reverse them.

| Date | Decision | Effect |
| --- | --- | --- |
| 2026-10-10 | **Owner release control:** one coordinating TAKATAK-V1 session merges and deploys until owner lifts the restriction | Other agents use feature branches + PRs; never push to main, run staging apply/release/production promote, mutate provider environments, or approve migrations |
| 2026-10-09 | MIMT runtime integration **on hold** | Do not resume MIMT/VoIP work without explicit owner reopening |
| 2026-10-09 | Food Hub PR #27 and Contabo/Coolify PR #104 frozen until core site is live | Do not merge or substitute hosting based on guesses |
| 2026-10-09 | Growth Suite PR #117 merged; overlap with #135/#136/#137 needs sequential coordination | Prefer existing reputation/SEO/AI surfaces; no duplicate modules or unapproved schema updates |
| 2026-10-08 onward | Database migrations follow staged reconciliation and owner approval | No direct production schema write, no unauthorized entries in approved migration list |
| 2026-10-08 onward | Public identity uses TAKATAK Auth (Supabase) with server-side client memberships | Only scoped records/entitlements; never trust browser claims for workspace IDs or role grants |
| Ongoing | GROUPE TAKATAK brand: electric blue on deep navy; old gold TK logo prohibited | Follow BRAND.md; replace assets only with approved official source files |
| Ongoing | AHMV and other vertical apps are independent products | TAKATAK centralizes identity/entitlements/events, not every vertical's menus and data |

## Technical constraints, not new owner decisions

- `main` is GitHub source truth; require passing CI, documented release artifact, an actual deployed SHA, and environment readiness before asserting success.
- The existing Next.js 16 project has version-specific conventions; follow installed Next docs before changing framework behavior.
- MochaHost/Passenger cannot be treated as a build machine. Build on Linux with Node 22 and deploy complete, verified immutable artifacts.
- Secrets are environment-managed; no private API tokens, secret values, phone numbers or customer records in PRs, docs or CI logs.
- ADS and CRM must respect tenant scopes. Server-side permissions/entitlements prevail over front-end controls.
- Provider statuses must distinguish not-configured, configured-but-untested and actually connected. Never label a stub as live.
- Pricing and performance marketing claims require real measurements; don't hardcode unverified comparative claims.

## Decisions pending, not assumed

- Production environment configuration and first approved release window.
- Separate staging and production migration backup/approval, including new schema items.
- Facturations and integration PR merge sequencing.
- Official GROUPE TAKATAK logo source files.
- QMAPS/SEO/AI provider overlaps, consent/retention policy and external API credentials.
- Whether and when to reopen frozen MIMT/Food Hub/Coolify tracks.

A future owner decision should be appended here with an ISO date, exact scope and reference (issue/PR/WORKLOG), then reflected in the task queue. Do not infer approval merely from code reaching `main` or a successful branch CI.


## 2026-10-15 pending proposal (not an owner decision)
PR #181 for direct Coolify and PR #185 for the CUBAFOOD contract are proposals with no production activation. Neither overrides the 2026-10-10 coordinator-only merge/deploy instruction, the paused Coolify track, or the 1LV-only master API. Owner must explicitly approve source registration and environment change.


## 2026-10-15 implementation note (not a new owner authorization)

Security PR #187 proposes a strict same-origin/bounded-JSON check before invited-user password changes; it does not change provider configuration. PR #185 defines but does not activate the CUBAFOOD source; PR #181 does not by itself authorize direct Coolify production. The operator/coordinator release-control decision from WORKLOG.md remains in effect.


## 2026-10-15 reconciliation of infrastructure state

Implementation fact, **not** a blanket release authorization: coordinating agents merged Coolify PR #181 into `main` at `b59ca994a73c5ed0e19e3d0f8d0540feddeb5e24`. Previous text saying the PR is still open is now superseded. The owner lock in WORKLOG.md still governs who may deploy or modify environment settings. CI for #187 and #188 addresses authentication and readiness integrity but neither commits nor runs a production release.

