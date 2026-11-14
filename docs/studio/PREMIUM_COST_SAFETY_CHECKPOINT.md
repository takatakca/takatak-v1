# TAKATAKSTUDIO — Premium workspace, cost controls and safety

2026-11-05 — STUDIO-ENGINE — Codex

Continued the saved V1 `48d028a`, Studio `32b2d5c`, Academy `704d766a` and
KnowledgeAI documentation draft. No source restart. V1 #256 and Academy #2
remain review drafts. Source changes below are not an activated service.

## Owner direction and product structure

The owner requested a premium, calm workspace comparable in clarity and
organization to ChatGPT, Word and Codex, with projects, libraries, agents,
schedules and connected apps. TAKATAK keeps its own blue/navy identity. Reference
screenshots and their private client/project names are not repository fixtures.

V1 Studio now has a navigation rail and phone drawer for Create, Projects,
Library, Your Agent, Scheduled, Apps & connections and Academy. Create centers
the brief composer. The scene editor is a document surface. Library uses a new
server-side, tenant-filtered search API with format filters and 20-item pages;
it is no longer limited to the thirty most recent drafts. Apps use existing
Social connections and provider authorities; there is no invented plugin store
or duplicate credential directory.

Scene selection loads the selected production's authoritative saved plan,
guards asynchronous responses and preserves unsaved edits by production. A
confirmed generation followed by list-refresh failure stays a success/recovery
case. A new paid generation is not a way to repair a missing list entry.

## Safety and existing authorities

- Existing Job records enforce exactly one attempt at selection, atomic claim
  and finalization. Current membership, permissions and write price are checked
  before dispatch. Persisted task metadata is validated before a provider call.
- Running claims are never reclaimed automatically. Ambiguous results, missing
  output links and uncertain storage stay held for operator reconciliation.
  New plans for that production are blocked while unresolved work remains.
  Losing completion ownership cannot report a ready draft.
- Social handoff locks the owned output and selected account before reading
  current source, format, content, brand and authorization availability. Existing
  SocialPost and Approval records remain the only review records. An unchanged
  replay returns their current state; changed/inconsistent records are held.
  This operation performs no external publication and supplies no publication
  receipt.
- Studio linking preserves TAK-TAK engine/mode/trial metadata. New central
  outputs retain the stable request ID, requested model alias and available
  provider token usage. Older records may lack this evidence. Provider metadata
  is not a commercial-rights certificate.
- Library metadata is whitelisted. All reads/writes use V1's authenticated
  workspace; imported IDs and model text never grant client or billing authority.
  Triple M's Macyna, Mariella and Matthys remain the owner's pilot, with no
  inferred personal attributes or shared client profiles.

## Economics and multiple agents

The owner's commercial goal is to reduce backend expense while selling clear
TAKATAK retail credits. Customer credit charges remain in the existing central
catalogue and ledger. Supplier credits, currency expenses and customer balances
are separate units. Provider savings are not transferred customer balances.

Queue creation now validates and returns a bounded cost plan: one writer task
per selected format/day, at most 28 tasks over seven days, with an explicit
retail-credit ceiling and no automatic top-up. Collaborator counts are bounded
planning policy, not a running parallel-agent implementation or permission to
multiply calls behind the customer's quote.

The new pure cost policy can select the cheapest eligible exact engine/model
only from fresh, versioned, audited supplier quotes and a spend ceiling. Premium
escalation needs matching approval. Exact artifact matching includes client,
project, brief digest/version, format and task revision. **Cost-ranked execution
and automatic artifact reuse are not connected or activated.** Existing Auto
uses a preference order and is not proved cheapest. Rates, actual provider
billing and revenue allocation are unavailable; expense and margin remain
unknown/unreconciled. See V1 `docs/studio/COST_CONTROLS.md` for contracts and limits.

## SONGER and genuine media

The owner confirmed the product name SONGER. The likely service is
[songer.co](https://songer.co/), but the actual account URL, plan and private
partner/API agreement were not verified. The [official terms](https://songer.co/terms)
restrict automated/nonhuman site access. No official public API documentation
was found. The [output-rights article](https://help.songer.co/en/articles/11332706-song-lyrics-and-artwork-ownership)
describes commercial, nonexclusive rights for specifically unlocked songs;
this does not establish a license to resell or white-label the service.

The supported direction is a manual companion: prepare lyrics/brief in Studio,
operate the existing SONGER account manually, then retain the unlocked audio,
track/variation, unlock evidence and license-source date before commercial use.
The UI links the manual service; audio import/storage is still to build. No
automated site scripting, unlock, purchase or generation was performed.

Central media-provider credentials already exist for services such as Runway
and ElevenLabs. The first-party Runway marketing CLI is not a tenant-safe SaaS
renderer. Existing asset helpers are scoped to other services and cannot be
silently repurposed for client media. YouTube's inspected OAuth scopes are
read-only identity/analytics, requiring incremental upload authorization through
the existing connection. Actual rendering, recorded music, typeset book/KDP
exports, native publication and destination-confirmed receipts remain unfinished.

## Verification and release gates

Verified: 70 focused V1 tests, existing TAK-TAK routing/trial suites, eight local
Studio engine/HTTP tests and two Academy course checks pass. Pure Studio and
relay modules pass isolated strict TypeScript checking with the repository
ES2017 target using the already-present compiler. Database-facing adapters
have syntax/service-fixture checks only. The actual-component browser fixture
passes desktop, 320, 390 and 768 px checks: drawer placement/keyboard/closing,
Library search, scene switching and dirty recovery, mutation-refresh failure,
request-ID reuse, account selection and current review status. Visual review
identified an intermediate drawer-transition screenshot problem; the drawer
transition was removed and explicit bounds/visibility checks now pass. Screenshots
use synthetic records. The fixture uses the pre-existing React 18.3.1 runtime;
the applications target React 19.2.4, so this is not exact-framework validation.
No dependency
installation, remote CI workaround, database migration, provider spend, account
creation, scheduler, merge or deployment was performed. Both Studio flags remain
off. Existing private KnowledgeAI issuer drafts #194/#195 were preserved.

Focused service tests use synthetic dependencies and modeled transactions;
they do not prove PostgreSQL row-lock behavior or authenticated two-workspace
HTTP isolation. Browser checks use the actual component bundled with existing
tools and synthetic API records; they do not prove the Next.js/auth/provider
application end to end. The available runtime is Node v24.19.0, while the
repositories target Node 22. Full framework lint/typecheck/build, generated
Prisma semantics, real database races and provider E2E remain outstanding.

The earlier automatic approval review rejected dependency installation because
of lifecycle scripts/downloads. The owner's instruction to preserve that
rejection remains in force. Source commits keep `[skip ci]`; no older green
workflow is claimed as validation of these changes.

— STUDIO-ENGINE — Codex
