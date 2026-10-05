# TAKATAK Knowledge Brain — Full-Fidelity Agent Memory

Status: **Foundation / architecture lock**

This module is the canonical long-term knowledge layer for TAKATAK AI agents. It is not a summary-only feature. Its job is to preserve every accessible source artifact faithfully, make it searchable, and expose controlled retrieval to agents without destroying provenance or replacing originals.

## 1. Non-negotiable fidelity rules

1. Preserve the original source whenever it is accessible.
2. Derived summaries, chunks, embeddings, tags, entities, OCR, transcripts, captions, timelines, and memories are additive layers only.
3. Never overwrite the raw source with a cleaned or summarized version.
4. Never invent, regenerate, or guess missing historical material.
5. If a conversation, image, attachment, message, or file is referenced but unavailable, create a backfill gap record with the source, reference, and reason it is missing.
6. Deduplicate imports idempotently, but do not collapse distinct source events that happen to contain identical text.
7. Every searchable result must retain provenance back to its original source object.
8. Agent retrieval must be tenant-scoped and permission-scoped.
9. Secrets, credentials, private keys, tokens, and passwords must never be exposed in normal agent retrieval or logs. Restricted material must be quarantined from embeddings/prompts while retaining an auditable source record where legally/operationally required.
10. Deletion/retention actions must be explicit and auditable. An AI-derived summary must never survive as the only copy of deleted raw evidence unless policy explicitly requires it.

## 2. Sources to ingest

The ingestion layer is connector-based and source-agnostic. It should support:

- Chat/conversation exports and archives
- Uploaded files and documents
- Images, screenshots, scanned documents, diagrams and generated media
- Code, snippets, scripts, prompts, command output and repository artifacts
- Email threads and attachments
- Google Drive / Docs / Sheets / Slides
- GitHub repositories, issues, pull requests, commits and relevant artifacts
- Field-recorded conversations/transcripts when authorized
- Calendar/event records when relevant to a project
- CRM/helpdesk/support records when authorized
- Future TAKATAK product data and app-generated records

A connector being unavailable must not be treated as an empty source. It must be reported as not connected, inaccessible, or pending backfill.

## 3. Canonical data model

The implementation should use distinct entities rather than one giant JSON table.

### KnowledgeSource
Represents an origin system or import source.
Suggested fields:
- id
- clientId / workspace scope
- type
- provider
- sourceAccountRef
- displayName
- status
- lastSyncAt
- cursor
- createdAt / updatedAt

### KnowledgeImportRun
Tracks each import/backfill operation.
Suggested fields:
- id
- sourceId
- status
- startedAt / completedAt
- cursorBefore / cursorAfter
- discoveredCount
- importedCount
- skippedCount
- failedCount
- errorSummary
- actor / job provenance

### KnowledgeThread
Represents a conversation, email thread, support thread, meeting, or coherent source stream.
Suggested fields:
- id
- sourceId
- externalThreadId
- title
- participants
- startedAt
- endedAt
- sourceUrl
- rawMetadataRef

### KnowledgeItem
Atomic immutable source event.
Examples: user message, assistant message, email, comment, transcript turn, code block, note, event.
Suggested fields:
- id
- threadId
- sourceId
- externalItemId
- parentExternalItemId
- itemType
- actorRole
- actorDisplayName
- occurredAt
- rawText
- rawHtmlRef
- sourceUrl
- sourceSequence
- contentHash
- metadata
- createdAt

### KnowledgeAsset
Original binary/file/media attachment.
Suggested fields:
- id
- knowledgeItemId
- sourceId
- externalAssetId
- storageObjectKey
- originalFilename
- mimeType
- byteSize
- sha256
- width / height / duration when relevant
- sourceUrl
- createdAt

### KnowledgeExtraction
Derived representation of an item or asset.
Examples: parsed document text, OCR, image description, audio/video transcript, code-language detection.
Suggested fields:
- id
- itemId / assetId
- extractionType
- extractor
- extractorVersion
- extractedText
- structuredData
- createdAt

### KnowledgeChunk
Retrieval unit built from immutable source text/extraction.
Suggested fields:
- id
- itemId / extractionId
- ordinal
- text
- tokenCount
- embedding
- embeddingModel
- contentHash
- createdAt

### KnowledgeEntity
Normalized people, organizations, projects, domains, locations, products, repositories, cases, tickets, dates and identifiers.

### KnowledgeRelation
Source-backed links between entities/items.
Examples:
- person -> works_on -> project
- message -> references -> repository
- file -> evidence_for -> case
- decision -> supersedes -> decision

### KnowledgeMemory
Curated/derived agent memory. Must always carry supporting source references.
Suggested fields:
- id
- clientId
- scope
- memoryType
- statement
- validFrom / validTo
- confidence
- sourceRefs
- supersedesMemoryId
- status

### KnowledgeGap
Tracks unavailable or missing history.
Suggested fields:
- id
- sourceId
- referencedFromItemId
- expectedType
- expectedExternalId
- description
- firstObservedAt
- status
- resolvedByItemId

### AgentKnowledgeGrant
Controls which agent/assistant may retrieve which sources, source groups, clients, brands, projects or sensitivity classes.

### KnowledgeRetrievalEvent
Audits every agent retrieval.
Suggested fields:
- id
- agentId
- userId
- clientId
- queryHash
- sourceScope
- resultRefs
- createdAt

## 4. Raw storage strategy

Binary originals must live in private object storage, not inside Postgres blobs.

Recommended buckets/prefixes:
- knowledge/raw/{workspace}/{source}/{yyyy}/{mm}/...
- knowledge/derived/{workspace}/{source}/...
- knowledge/previews/{workspace}/{source}/...

For every raw object persist:
- SHA-256
- byte length
- MIME type
- original filename
- source identifier
- source URL when available
- import-run identifier

The database stores metadata and durable storage references.

## 5. Images and screenshots

For images, preserve the original bytes first.

Derived processing may add:
- dimensions
- EXIF-safe metadata when useful
- OCR text
- visual description
- detected entities
- thumbnail/preview
- image embedding

Never replace an image with OCR or a textual description. The original remains the authority.

## 6. Documents and files

Preserve the original file, then derive:
- parsed text
- page/range map
- headings
- tables
- extracted images
- code blocks
- metadata

Every extracted fragment must be able to resolve back to:
- file
- page/sheet/slide/section
- source location when available

## 7. Audio and video

Preserve originals when source access permits.

Derived layers:
- transcript
- speaker turns
- timestamps
- chapters/scenes
- visual keyframe descriptions
- entities and topics

A transcript never replaces the original recording.

## 8. Code and repositories

Repository ingestion should preserve:
- repository
- branch/ref
- commit SHA
- path
- blob SHA
- exact file content
- issue/PR discussion
- commit/PR provenance

Knowledge retrieval should prefer exact repository truth for implementation questions instead of stale summaries.

## 9. Search modes

The dashboard must eventually support:

- Exact text
- Hybrid lexical + semantic
- Source-filtered
- Date/timeline
- Project
- Person/entity
- Repository/file
- Attachment/media
- Decision
- Prompt/instruction
- Conversation/thread

Results must display source provenance and open the original when possible.

## 10. Ingestion and backfill behavior

Ingestion must be:
- idempotent
- cursor-based where APIs support it
- restartable
- observable
- checksum-aware
- version-aware
- non-destructive

Recommended flow:
1. Discover source objects.
2. Persist source metadata.
3. Download/preserve raw material.
4. Calculate hashes.
5. Upsert immutable source identity.
6. Extract text/media metadata.
7. Chunk.
8. Embed.
9. Entity-link.
10. Build source-backed memories/timelines.
11. Update import cursor.
12. Record failures/gaps for retry.

## 11. Deduplication

Use source identity first:
- source + external object/thread/message ID

Use hashes second:
- SHA-256 for binary assets
- normalized content hash for exact duplicate detection

Do not merge two separate messages solely because their text matches. Preserve event identity and chronology.

## 12. Agent retrieval rules

An agent request should resolve:
user -> workspace/client -> agent -> grants -> allowed knowledge sources -> retrieval policy.

Retrieval output should provide:
- source-backed passages
- stable source refs
- timestamps
- source type
- original object link when available
- sensitivity label
- freshness/version metadata

The agent may summarize the retrieved material, but the knowledge service must return evidence references.

## 13. Freshness and authority

Each source or source group should support:
- authority priority
- freshness requirement
- active/inactive state
- superseded state
- last successful sync
- last observed source modification

Historical records must remain searchable even after a newer decision supersedes them. Newer facts should be linked using explicit supersession/version relationships.

## 14. Dashboard surface

Primary route:
- `/dashboard/knowledge`

Planned child routes:
- `/dashboard/knowledge/search`
- `/dashboard/knowledge/sources`
- `/dashboard/knowledge/conversations`
- `/dashboard/knowledge/files`
- `/dashboard/knowledge/media`
- `/dashboard/knowledge/entities`
- `/dashboard/knowledge/timeline`
- `/dashboard/knowledge/memories`
- `/dashboard/knowledge/gaps`
- `/dashboard/knowledge/imports`
- `/dashboard/knowledge/agent-access`

The overview should show:
- total preserved source items
- conversations
- files/media
- indexed chunks
- connected sources
- pending backfills
- failed imports
- last sync
- retrieval activity

## 15. Initial backfill priority

1. Existing TAKATAK project documents and handoffs.
2. GitHub repositories and implementation history.
3. Conversation/history exports available to the user.
4. Existing uploaded documents, screenshots and attachments.
5. Google Drive project material.
6. Gmail project/business correspondence where intentionally included.
7. Field transcripts/recordings where intentionally included.
8. Remaining connected systems.

## 16. Explicit limitation policy

The system must never claim to have historical content it cannot access.

If source history is not exposed by an API/connector or has been deleted, the UI must say so and create a KnowledgeGap. Later exports, uploaded archives, or newly connected providers can resolve the gap.

This is mandatory because the Knowledge Brain is intended to become the source-faithful smart memory used by future TAKATAK AI agents.
