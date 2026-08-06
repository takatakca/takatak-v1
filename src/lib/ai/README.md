# AI Studio Data Layer (Phase 9)

Pattern: all AI Studio data flows through `ai-data.ts`; pages never import
Prisma directly. Every function returns `{ source, sourceLabel, ... }` —
database when configured and queries succeed, otherwise typed mock foundation
data mirroring the seed, with safe error logging and no crashes.

Provenance rules (the heart of Phase 9 honesty):
- `SavedAiOutput.origin` declares where content came from:
  * `foundation_template` — hand-written template seeded by TAKATAK. NOT AI.
  * `manual` — typed by a user.
  * `ai_generated` — RESERVED. Only usable after a real provider call
    succeeds in a later phase. Nothing in Phase 9 sets this value.
- No file in this folder calls OpenAI or TryHolo. No generation runs.
- `providers.ts` reports readiness only: OPENAI_API_KEY presence, TryHolo
  gated behind TRYHOLO_ENABLED=true. States: not_configured /
  configured_untested / disabled / error / connected — "connected" is
  reserved for future real tested providers. No endpoint is ever guessed.
- "Send to approval" and "send to Metricool" are future workflow steps; the
  status enum reserves `sent_to_approval` but no action performs it yet.

Provider boundary: real OpenAI/TryHolo adapters arrive in their own phases,
following the Metricool/Upmind ladder (env validation → safe client →
adapter → test connection → connected only after a real success).
