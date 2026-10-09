# MIMT — canonical product & agent onboarding (8 October 2026)

> **One place, one priority.** This folder is the long-term product brief for MIMT under the TAKATAK ecosystem, **not** a second codebase or a mandate to create ten tickets. Main execution issue: [TAKATAK AUTH #141](https://github.com/takatakca/takatak-v1/issues/141). Product boundary and integration contract (from former PR #140): [INDEPENDENT_PRODUCT_BOUNDARY.md](INDEPENDENT_PRODUCT_BOUNDARY.md). No merge, deployment or procurement is authorized by these documents.
>
> **Every incoming agent:** read `AGENTS.md`, top 40 lines of `WORKLOG.md`, open PR titles, this README, and the relevant detailed file below **before writing code**. Claim a worklog entry; don't duplicate active work. Report real evidence. Keep unknowns visibly unknown.

## Product boundaries, ownership and long-term intent

- **TAKATAK** (repository `takatak-v1`) owns its platform: Supabase-backed master identity, the agency's own customer/contract/lead CRM, dashboards, cross-service authorized links, management, logs, Stripe orchestration. Its existing `knowledgeAI` initiative is a separate knowledge system; do not place customer secrets or confidential source material in public code.
- **MIMT** is an independent communications brand/service operated and supported through TAKATAK for a contractual management term. It can be bought out/transferred; its own app subscribers, billing, telecom line provisioning, communications data, carrier credentials, and customer portability must not require TAKATAK's proprietary runtime to keep functioning. TAKATAK retains only its legitimate agency business/customer relationship records subject to agreements and privacy obligations.
- **ONE verified person/account mapping, NOT one shared customer-content lake.** An end subscriber of MIMT is not automatically a marketing lead for TAKATAK. Store authorized, provenance-tagged identity/agency relationships only; no indiscriminate mirroring of contacts, SMS, recordings, or calling histories into agency AI.
- **Immediate critical priority: fix TAKATAK AUTH.** Real phone-first signup/login by Supabase Auth + configured Twilio SMS provider, stable MasterIdentity and tenant-accurate onboarding. MIMT telephony and site rebuild follow in that order, without blocking auth.
- No Upmind needed for MIMT; do not buy SendGrid just because Twilio handles SMS; keep existing working email path until any Resend configuration is verified. Telecom wholesale relationships are commercial opportunities, not yet proven operational programmable provisioning APIs.

## Actual states: distinguish work from ambition

| Capability | Current evidence | Safe next action |
| --- | --- | --- |
| TAKATAK phone OTP | `master-phone-login-form.tsx`, `otp-form.tsx`, Supabase phone verification code exists | Confirm live provider config and real SMS test; repair phone-only email/schema dependency ([AUTH_AND_CRM.md](AUTH_AND_CRM.md)) |
| MasterIdentity, Clients, Leads | Prisma models and profile sync exist | Prove tenant isolation, authenticated mapping, consent and provenance |
| MIMT application / source | No clearly identified MIMT standalone repo in connected TAKATAK GitHub listing at audit time; draft boundary only | Inventory actual website hosting/source and mobile builds before creating another repo; design standalone app when funded/approved |
| Website `https://mimt.ca` | Public HTML exists but still has Fongo labels and unverified MIMT products/prices; not launch-ready | [WEBSITE_REBUILD.md](WEBSITE_REBUILD.md) |
| Twilio Voice + app | Design/demo work; no production end-to-end account evidence reviewed | Real Android+iOS/WebRTC/calls, number inventory/911/SMS test |
| Vidéotron/Bell/Rogers | Correspondence and applications exist; contract/API/reseller scope NOT verified from reviewed records | [CARRIERS_AND_COMPLIANCE.md](CARRIERS_AND_COMPLIANCE.md); keep NDA/agreements private |
| MIMT wireless SIM/eSIM, residential/business Internet | Intended growth lines, not live fulfillment | Partner contracts, wholesale terms and operational provisioning before sale |

## Product families — **planned**, not advertised as activated

1. **MIMT Mobile Free**: 7-day or 14-day provider-backed trial, ad-supported, optional DID, strict cap on voice/SMS and total fraud spend; honest number-retention conditions.
2. **MIMT Mobile Plus / Pro**: recurring weekly/monthly options, ad-free and number-lock/add-ons, verified quotas, number porting where contractually enabled; payments may need Stripe/web or StoreKit/Play Billing depending on platform-specific rules.
3. **MIMT Works**: paid business phone service: auto-attendant, IVR, extensions, teams, schedules, hunt groups/queues, voicemail, call forwarding, transfer, browser/mobile client, E911 and support. No unlimited usage promises until pricing validated.
4. **MIMT Wireless**: future authorized reseller cellular SIM/eSIM voice/data or data-only solution; dedicated wholesale carrier and provisioning agreement required. A Twilio programmable number is not itself a cellular SIM.
5. **MIMT Internet Residential / Business**: future reseller or independent ISP using signed partner channels (Vidéotron AITP, other wholesale, branded referral/agency model). These are distinct legally and operationally; no unsupported automatic service fulfillment.
6. **Agent/partner channels**: Bell, Vidéotron, Rogers, TELUS/Fido and DID/SIP wholesalers can be compared. Never assume authorized-agent eligibility means unrestricted white-label resale, carrier APIs, SMS support or instant ports.

## Intended code ownership / directories (PLANNED PATHS; do not create code folders before scoped milestone)

```text
takatak-v1/                                  (EXISTING central repo)
  AGENTS.md                                 (agent entrypoint)
  WORKLOG.md                                (who is working on what)
  docs/mimt/README.md                      (this master record)
  docs/mimt/AUTH_AND_CRM.md                (first deliverable)
  docs/mimt/WEBSITE_REBUILD.md             (site accuracy + design)
  docs/mimt/CARRIERS_AND_COMPLIANCE.md     (wholesale and regulatory gates)
  src/lib/auth/                            (existing canonical auth + profile sync)
  src/lib/integrations/mimt/                (FUTURE signed/tenant-scoped MIMT API client)
  src/app/dashboard/...                     (FUTURE authorized agency MIMT overview)

MIMT independent source, LOCATION NOT YET VERIFIED/CREATED:
  apps/web/                                (MIMT consumer/business marketing/account)
  apps/mobile/                             (React Native iOS/Android native calling)
  services/api/                            (subscriber, call control, DID, SMS)
  services/worker/                         (jobs, reconciliation, port orders)
  packages/domain/                         (IDs, tariffs, entitlements, invoices)
  packages/provider-adapters/              (Twilio first, wholesale later)
  packages/contracts/                      (versioned TAKATAK signed API events)
  infra/                                   (separate DB/secret/deploy/backup/monitoring)
  docs/                                    (customer disclosures, no raw confidential contracts)
```

**Do not create a copy of `takatak-v1` inside MIMT or another global CRM.** MIMT's data is sovereign; auth uses a signed issuer/audience-specific federation subject or a properly supported external auth service. A separate MIMT login recovery/issuer exit strategy must exist for buyout, not a forced dependency on TAKATAK remaining administrator.

## Nonstop agent handoff: finite, auditable milestones

**Gate 0 — Current fact-finding:** confirm actual source/deploy of `mimt.ca`, real Supabase staging vs live project, Twilio account settings (presence only), product roles and carrier contract status. Report confirmed/untested/blocked with evidence.

**Gate 1 — TAKATAK AUTH (P0, execute now):** phone-only registration, SMS OTP, verified master identity, new/existing workspace + scoped CRM, email fallback/recovery, rate limits, RLS, multi-tenant tests, CI + staging real SMS. This is the only code milestone now. See [AUTH_AND_CRM.md](AUTH_AND_CRM.md) and #141.

**Gate 2 — Website truth + conversion (after auth evidence):** remove Fongo copy and unsupported claims, create honest modern bilingual responsive UX, truthful price/availability and real signup/waitlist, service availability + legal disclosures; test before redirecting traffic. See [WEBSITE_REBUILD.md](WEBSITE_REBUILD.md).

**Gate 3 — Working VoIP pilot:** first valid Canadian number, Twilio app/native calling, 2-way SMS, voicemail, admin/usage/cost ledger, real iOS/Android test, mandatory 9-1-1/CRTC steps prior to public PSTN offering.

**Gate 4 — Business + subscriptions:** Stripe billing and appropriate app-store payments, seat/tenant entitlements, MIMT Works IVR/extensions/queues, reseller partner proposals, customer care. No duplicate Facturations payment authority.

**Gate 5 — wholesale/porting/SIM/Internet:** only after legal, API and fee verification. Provider abstraction and asynchronous porting allow moving selected customers while keeping their stable app subscriber ID. Do not promise instantaneous transfer or delete the old DID before confirmed cutover.

## Rules every agent follows

- No paid vendor provisioning, changes to live auth settings/DNS, CRTC submissions, importing subscribers into a knowledge base, or PR merges/deploys without the applicable approval and verified release gates.
- Never commit credentials, personal emails, customer phone numbers, supplier NDA terms or attached confidential contracts in this public repo. Keep an internal evidence index under restricted source storage.
- Version all externally visible plan prices, terms, permissions and carrier capabilities; record product source of truth and rejection reasons.
- Protect 911/emergency flows from spend caps and ads; clear customer disclosures, portability, CASL consent and Québec privacy/french-language rules.
- Each work session: take the highest unblocked **Gate 1** item, write tests, create one reviewable PR, update `WORKLOG.md` and #141 with changed paths, tests/results, environment, blockers and next step. Do not invent completed work.
