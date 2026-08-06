# TryHolo Adapter (placeholder — no implementation yet)

Future home of the TryHolo integration adapter.

Purpose: optional creative AI provider — content/video ideas, hooks, captions, ad creatives, creative briefs. The platform must never depend on it; gated by TRYHOLO_ENABLED=false.

Rules:
- Typed service interface; the rest of the app never calls TryHolo APIs directly.
- Credentials from environment variables only (TRYHOLO_API_KEY, TRYHOLO_ENABLED), server-side only.
- Connection states: not_configured / configured_untested / connected / error.
- No fake API calls, no fabricated data. Until real credentials and real calls exist, this provider is NOT connected.

Built in: Phase 9
