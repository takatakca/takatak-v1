# AI provider keys

Admin › **AI provider keys** (`/dashboard/admin/ai-providers`) is where a platform owner or admin enters the API key of each AI provider. Clients use these providers through AI credits (the credits ledger from the Growth Suite, #117); this panel only holds the keys.

## How it works

- One key per provider, stored in `ai_provider_credentials`.
  - The key is encrypted with AES-256-GCM, using `GROWTH_TOKEN_ENCRYPTION_KEY_V1`, with the provider bound as additional data.
  - Only the last four characters are kept in clear.
  - A key is never sent back to a page, logged, or written to the audit log.
- **Test the key** sends one read-only request to the provider (usually its model list). It generates nothing and spends no provider credits.
  - A key is shown as "Key works" only after the provider answers with a 2xx status.
  - Saving a new key clears the old result.
- Providers with no read-only endpoint can store a key, but are never shown as working. Today these are Perplexity, Revid, Suno, Lovable and Cursor.
- Server code gets a key with `resolveProviderKey(provider)` (`src/lib/ai-providers/store.ts`). It returns the saved key first, then the provider's environment variable.
- Every save, replace, test and removal writes an audit entry (`ai_provider_key.*`) with the provider and the last four characters only.

## Providers (checked against each provider's docs on 2026-10-09)

| Provider | Key test | Resold to clients |
|---|---|---|
| Anthropic Claude | Official SDK `models.list` | yes |
| OpenAI, xAI Grok, Mistral, DeepSeek, Groq, Cohere | `GET …/models` with a Bearer key | yes |
| Google Gemini | `GET v1beta/models` with `x-goog-api-key` | yes |
| ElevenLabs | `GET /v1/user` with `xi-api-key` | yes |
| Runway | `GET /v1/organization` (`X-Runway-Version: 2024-11-06`) | yes |
| HeyGen | `GET /v2/user/remaining_quota` with `X-Api-Key` | yes |
| Twelve Labs | `GET /v1.3/indexes` with `x-api-key` | yes |
| Stability AI | `GET /v1/user/account` | yes |
| Perplexity | none (no read-only endpoint) | yes |
| Revid | none (only render calls, which spend credits) | yes |
| Suno | none (no public API; partner program only since July 2026) | no |
| Lovable, Cursor | none (team tools, not client AI services) | no |

GitHub Models was retired on 2026-07-30, so it has no slot.

## Setup

1. Put `GROWTH_TOKEN_ENCRYPTION_KEY_V1` (32 random bytes, Base64) in the server environment. The Growth Suite already uses it for Google tokens.
2. Apply migration `20261009100000_ai_provider_credentials`.
   - Like every migration, it goes through the approved staging and production lists first. It is not in those lists yet.
   - Rollback: `scripts/rollback/ai-provider-credentials-down.sql`.
3. Open Admin › AI provider keys, paste each key, then press **Test the key**.

## Tests

- `npm run qa:ai-provider-keys`: catalog, request building, outcome mapping, and static safety checks. No database, no network.
- `npm run qa:ai-provider-keys-db`: encryption, audit, test results, replace races, the provider binding and the environment-variable fallback, run against a loopback database with fake provider responses.
