# AI Studio — live draft generation (TK-023)

AI Studio had the full data foundation (brand voices, jobs, saved outputs, provider events) but no live generation. This branch adds generation, under the rules the foundation already set:

- **Drafts only.** Every result is saved as `SavedAiOutput` with `origin = ai_generated` and `status = draft`. Nothing is published, scheduled or sent anywhere.
- **Off by default.** Nothing runs until an administrator sets the server variables below.
- **Honest labels.** Templates, manual text and AI drafts keep distinct origin labels in Saved outputs.

## What a user does

`/dashboard/ai-studio/content-generator` (permission `create_content`, active workspace):

1. Choose the content type: caption, hashtags, hooks, calls to action, long post, video ideas or creative brief.
2. Choose the platform, the language (Canadian English or French) and optionally a brand voice from the workspace.
3. Enter the goal or offer and optional context.
4. Generate.

The draft appears with **Copy** and **View saved drafts**.

The prompt tells the model to use only the facts given and never invent prices, dates, addresses, phone numbers, awards, reviews or guarantees. The brand voice adds tone, audience, preferred words, banned phrases, notes and a sample.

## Safeguards

| Safeguard | How |
| --- | --- |
| Feature gate | `AI_STUDIO_GENERATION_ENABLED=true` plus a key and model, checked before anything else |
| Who | `create_content` in the active client workspace (platform-admin view must select a workspace) |
| Input | Whitelisted content types and platforms; goal ≤ 500 characters, context ≤ 2,000; brand voice must belong to the workspace |
| Cost | `AI_STUDIO_DAILY_LIMIT` (default 50) per workspace per rolling 24 h, counted from job rows; output capped at 900 tokens; 45 s timeout |
| Provider | Fixed HTTPS endpoints (`api.openai.com/v1/chat/completions`, `api.anthropic.com/v1/messages`), redirects refused. The key is sent only there and never reaches the browser |
| Errors | Reduced to short codes (`auth`, `rate_limited`, `timeout`, …); provider error text is never shown or stored |
| Records | `AiContentJob` (running → completed or failed, with model and requester), `AiProviderEvent` (status, token counts; no prompt text) |

## Configuration (server only)

```
AI_STUDIO_GENERATION_ENABLED=true
AI_STUDIO_PROVIDER=openai            # or anthropic
OPENAI_API_KEY=...                   # when openai
AI_STUDIO_OPENAI_MODEL=...           # required for openai (no default is guessed)
ANTHROPIC_API_KEY=...                # when anthropic
AI_STUDIO_ANTHROPIC_MODEL=...        # optional, default claude-sonnet-5-5
AI_STUDIO_DAILY_LIMIT=50
```

A ChatGPT subscription is not an API key. The owner needs an API key from platform.openai.com (OpenAI) or console.anthropic.com (Anthropic).

Migration `20261006160000_ai_provider_anthropic` adds `anthropic` to the `AiProvider` enum.

## Verification

- `npm run qa:ai-studio-generation` (runs in CI): 8 checks covering:
  - config gate
  - input whitelist, including a bug found and fixed: `"toString"` was accepted as a content type
  - prompt rules
  - request shape for both providers
  - error mapping
  - draft-only saving
  - daily cap
  - foreign brand voice refused
  - failure bookkeeping
  - route and page gating
- Migration: a fresh PostgreSQL with `main`'s schema plus this migration matches the branch schema exactly (`prisma migrate diff` exit 0).
- Real network test on real PostgreSQL: both providers were called with a deliberately invalid key. Each returned `auth`; the job was recorded `failed`, a provider event `failed / auth` was written, and no draft was saved.
- **Not yet done:** a successful generation with a real key. That needs the owner's API key on the server.

## Not built yet

- Sending a draft to the approval workflow or to Social publishing.
- Campaign builder and video-ideas pages (they remain foundations).
- Usage and cost dashboard.
