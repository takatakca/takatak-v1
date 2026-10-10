# Proposal: client independence, commercial states and data rights

**Status: PROPOSAL. Not implemented. Needs owner and dev review before any code lands.**

This applies the model in `takatakca/knowledgeAI` (`docs/11-CLIENT-INDEPENDENCE-TRANSFER-ARCHITECTURE.md`) to `takatak-v1`.

## What it would add

### 1. Commercial lifecycle per client (`client_engagements`)

- **States:**
  - `trial`
  - `active_managed`
  - `payment_attention`
  - `suspended_by_contract`
  - `transfer_pending`
  - `transfer_ready`
  - `transferred`
  - `terminated`
- **Transitions are explicit.** For example:
  - `active_managed → payment_attention | suspended_by_contract | transfer_pending | terminated`
  - `suspended_by_contract → active_managed` (reversible)
  - `transferred` is final.
- **Every change is recorded** in an append-only `client_engagement_events` log (who, why, contract reference) and in `audit_logs`.
- **Suspension pauses TAKATAK work only:** AI agents, credit spending and outbound messages. The client's site, data and inbox stay intact. Nothing is ever deleted or corrupted.
- **`transferred` / `terminated` switch off TAKATAK's embeds** (analytics, chat, review page). They do this with the existing `active` flags and record exactly which ids were switched, so reactivation restores the same set.

### 2. Lead provenance and rights (new columns on `leads`)

- **New columns:**
  - `dataClass` (`unclassified`, `client_first_party`, `takatak_originated`, `shared_campaign`)
  - `sourceNetwork` (client website/chat/review page/import, TAKATAK ADS, FLEX'S, QMAPS, ON2GO, agency)
  - `sourceCampaignRef`
  - `licenseScope` (`client_owned`, `contract_term_license`, `takatak_retained`, `contract_review_required`)
  - `consentBasis` (`express`, `inquiry`, `none_recorded`)
  - `rightsReviewedAt` / `rightsReviewedByProfileId`
- **Existing leads stay `unclassified` + `contract_review_required`.** Nothing is assumed.
- **Database checks:**
  - a TAKATAK-originated lead must name its network;
  - client first-party data can never be marked "retained by TAKATAK".
- **New leads from the client's own chat or review page** are recorded as `client_first_party`. Their consent basis is `inquiry` (chat) or `express` (review follow-up).

### 3. Transfer terms and package

- **Per-client terms** come from the signed agreement: `included`, `excluded` or `contract_review_required`. They cover platform data, first-party data, TAKATAK-originated leads and shared/derived data.
- **Fixed exclusions:**
  - TAKATAK agency data, credentials and third-party-governed data are always excluded;
  - those integrations are reconnected under the client's own accounts instead.
- **A transfer inventory page:**
  - record counts per data class;
  - what stops when TAKATAK disconnects;
  - which accounts must be re-authorized;
  - blockers.
- **Blockers:**
  - unclassified leads, or anything still `contract_review_required`, block `transfer_ready`;
  - an active Google Business Profile connection or an active Growth subscription blocks `transferred`.
- **Export (platform admins only):**
  - available only once the transfer is pending;
  - contains only data whose treatment is `included`;
  - every export is logged.

## Questions for the owner (legal/contract)

1. Default terms for new contracts: is client first-party data `included` at transfer?
2. Are leads from TAKATAK networks licensed for the contract term only (`contract_term_license`), or retained by TAKATAK?
3. On non-payment, which services may be paused, and after how many days? This must match the signed agreement.
4. Who may change a client's state: platform owners only, or also account managers?

## Notes for the developer

- A parked prototype exists (not committed). It must be rebuilt from this design, not copied: the prototype used `cancelled`, but the enum value is `canceled`.
- Phase it: schema + policy + tests → admin UI → gates on agents/credits → export. Run each phase through review.
- Follow the same safeguards as the Growth Suite:
  - one migration per phase;
  - RLS on, with browser grants revoked;
  - not added to the approved-deploy lists until the owner approves;
  - a matching rollback script.
