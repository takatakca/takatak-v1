# TAKATAK AI File Organizer — Implementation & UX contract
Date: 2026-11-15
Status: SPECIFICATION ONLY — NOT IMPLEMENTED OR DEPLOYED
Integration: existing TAKATAK V1 authentication, workspace memberships and dashboard. No second auth or billing system.

## Product objective
Authorized TAKATAK users upload or connect files for their own workspace, preserve immutable source originals and provenance, search by filename and content, and ask scoped AI agents questions with verifiable file/page citations. CCC project is an optional explicitly authorized project source; never ingest it across workspace boundaries.

## Journey and route proposals (confirm existing routes before implementation)
1. Public landing `/ai-file-organizer`: product value, privacy statement, sign in, request access; no invented public metrics.
2. Login: reuse existing TAKATAK login/session, return URL and safe redirect; email verification and recovery follow existing auth.
3. Workspace selection `/dashboard/knowledge`: accessible workspaces only; empty, loading, forbidden, error states.
4. Source library `/dashboard/knowledge/files`: folder tree, upload, search, filters, sort, preview, version history, delete/restore requests.
5. Upload wizard: choose workspace/project/folder, select files, confirm rights, upload progress, checksum, duplicate warning, malware scanning, extraction and indexing statuses.
6. Ingestion monitor: queued → scanning → extracting → chunking → embedding → ready; retry and error details; no claims of readiness until successful.
7. AI chat `/dashboard/knowledge/chat`: choose workspace, project and allowed sources, question composer, streamed answer, file/page citations, evidence preview, insufficient-evidence response.
8. Agent builder `/dashboard/agents/new`: name, role, allowed knowledge collections, tools, languages, limits, preview, publish only after review.
9. Agent list/details: draft, active, paused, archived; usage, audit events, version rollback.
10. Team access: invite existing TAKATAK identities, workspace roles, project/file access policies, access-change audit.
11. Integrations: authorized GitHub and Drive sources with incremental sync, status, revocation and error handling.
12. Settings: data retention, export, deletion, model/provider selection, quotas, billing link to existing system.
13. Admin observability: queue health, failure counts, latency, cost, authorization failures, backup/restore tests.

## UX design system
Desktop 1440 px canvas, 240 px navigation, max 1200 px content; mobile 360–430 px with collapsible navigation; 8 px spacing grid; 44 px minimum touch targets; keyboard focus visible; WCAG 2.2 AA target. Follow BRAND.md (electric blue/deep navy, no legacy gold TK). Support FR/EN labels and responsive tables/cards.

## Security and data model requirements
Workspace_id and project_id mandatory on sources, files, chunks, conversations and agent grants. Enforce authorization in server queries AND vector retrieval. Object storage private, signed short-lived download URLs, encryption at rest and in transit, audit events, rate limiting and cost ceilings. Treat retrieved documents as untrusted content, never instructions. Do not use user files for model training without explicit authorization. Preserve original bytes and source metadata; derived summaries and embeddings are replaceable indexes. Versioned retention/deletion, legal hold support and backups.

Suggested entities: KnowledgeSource, KnowledgeFile, FileVersion, ExtractionJob, KnowledgeChunk, Agent, AgentKnowledgeGrant, Conversation, Message, Citation, WorkspaceMember, AuditEvent, SyncRun. Reuse existing models where possible; migration requires review.

## Acceptance tests before live
- Workspace A cannot search, cite, preview or download workspace B data.
- File upload → verified checksum → extraction → indexing → citation-backed response.
- Malicious file and prompt-injection fixtures rejected or safely treated as data.
- Revoked team member loses access to existing conversations and source links.
- Duplicate upload, failed extraction, sync conflict and retry are deterministic.
- FR/EN keyboard and mobile layouts verified.
- Billing limits enforced server-side; no unapproved charges.
- CI typecheck, lint, auth tests, migration dry-run, build and staging smoke pass.
- Production release requires owner/coordinator approval, existing deployment runbook, health checks and rollback evidence.

## Implementation sequence
P0 inventory existing knowledge/AI routes, schemas, auth, deployment and open PRs.
P1 landing + navigation + responsive UI.
P2 secure workspace file storage and metadata.
P3 extraction/indexing worker and monitoring.
P4 citation-grounded retrieval/chat.
P5 agent configuration and permissions.
P6 integrations and incremental sync.
P7 QA/security/performance/accessibility.
P8 staged release, production smoke and operator documentation.

## Handoff
This PR contains design/engineering documentation only. It does not activate routes, add production services, modify billing, or assert compliance certifications. Respect AGENTS.md, WORKLOG.md and protected release gate before coding.

## Owner correction — AI-first embedded organization (2026-11-15)
This section overrides the earlier proposed standalone journey and route assumptions. DO NOT add a new landing page, new signup, independent agent builder, new billing, duplicate studio, or separate cPanel. First inventory the actual dashboard routes and permissions. Integrate as a reusable service and contextual controls inside existing Files/Studio/Agents/Hosting screens, plus one settings panel and a shared approval inbox where appropriate.

### Existing integration candidates identified on main (not yet full code audit)
- `src/lib/integrations/knowledgeai/policy.ts` — existing knowledge access policy.
- `src/lib/studio/library-policy.ts`, `src/lib/studio/output-link.ts`, `src/lib/studio/agent-jobs.ts`, `src/lib/studio/agent-service.ts` — existing studio library/output/agent job infrastructure.
- `src/lib/website-leads/attachment-storage.ts`, `src/lib/website-leads/attachments.ts` — existing attachment handling and security.
- `docs/TAKATAK_HOSTING_CONTROL_CLIENT_PANEL.md` — existing client hosting controls.
- `docs/KNOWLEDGEAI_MASTER_ISSUER.md` — existing knowledge integration.
Verify behavior and reuse boundaries before implementing; filenames alone do not prove a capability is live.

### Target automation
An authorized upload, existing studio output, approved connected source sync, or client-created file emits an idempotent file-created event. Existing background job infrastructure schedules classification/extraction with bounded retries. The classifier proposes tenant/project/category/destination, suggested filename and confidence with evidence. The rules engine selects:
- **auto**: only when the owner explicitly enables auto-file for a narrowly scoped folder/source/file class and confidence/policy thresholds pass.
- **ask**: a small inline modal or approval inbox item with preview, suggested destination, Approve / Change / Reject; no file move before approval.
- **manual**: existing file-management flow remains accessible.
- **off**: no AI analysis; ordinary existing upload remains available.

The system never creates a new customer, workspace, permission, or billing subscription. Never infer tenancy from file text alone. Preserve the immutable original, store metadata/index separately, and make reversible destination assignments. Use existing storage and server-side access checks. Do not physically move hosting/cPanel files or publish to connected systems without explicit scoped authorization and safe connector support.

### Settings
Inside existing account/workspace settings: master AI organizer toggle (default OFF until consent), modes off/suggest/auto, allowed source categories, target folders, confidence threshold, approval requirement, retention, notification channel, AI spend ceiling, per-action activity log, revoke, and manual correction. Manager controls policies; client may override within granted role. Explain the difference between organizing a dashboard index and moving actual files on a host.

### AI agent interface
Expose authorized source search and metadata actions as scoped tools to the EXISTING agents/studios. An agent can propose a move/tag and request approval; only an approved server-side operation can commit. Agent responses cite original file provenance. No new agent identity or agent builder is necessary.

### Acceptance cases
Upload → auto suggestion → Approve → existing client dashboard file listing updates; Reject leaves original unchanged; Change destination revalidates permission; duplicate events don't duplicate records; undo restores prior classification; auto mode respects exact policy; off mode creates no AI jobs; other tenant's file never appears in suggestions, search, previews or agent context; studio outputs and hosting uploads do not get silently moved; agent costs capped. Add QA fixtures and actual production smoke evidence before marking functional.

### Immediate next engineering action
Read full existing dashboard screen architecture, auth/tenant policy, studio library, knowledge policy, attachment storage, hosting control and existing job schema. Produce a concrete file-by-file integration map and collision assessment. Implement the first safe vertical slice on this feature branch with tests; do not merge until CI and coordinator review. 
